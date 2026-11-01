"""CosyVoice 2 for Shotloop's Chinese voice-over, as a small local server.

Loading the model takes a while (about 15 s), so one server serves every
engine process: it listens on a Unix socket, speaks one sentence per
request, one at a time, and exits after ten idle minutes. Started by
voice/src/cosyvoice.mjs.

    python cosyvoice_server.py <install dir> <socket path>

The install dir (models.mjs, 'cosyvoice-zh') holds:
    CosyVoice/       the code (with third_party/Matcha-TTS)
    model/           CosyVoice2-0.5B
    wetext/          zh/tn and en/tn tagger.fst + verbalizer.fst (text normalization)
    voices/<id>.wav  a voice's reference recording, voices/<id>.txt its words

A request is one JSON line: {"text", "voice", "speed", "out"}; the reply,
one JSON line: {"ok": true, "rate", "samples"} with the speech written to
out as raw little-endian float32, or {"ok": false, "error"}.
"""

import json
import os
import socket
import sys
import traceback

IDLE = 600

root, sock_path = sys.argv[1], sys.argv[2]
sys.path[:0] = [os.path.join(root, 'CosyVoice'), os.path.join(root, 'CosyVoice', 'third_party', 'Matcha-TTS')]

# pyworld (a C extension, no wheel for Apple silicon) is only used by the
# training data pipeline, which the model's config names: an empty module
# stands in, so the install needs no compiler
import types
sys.modules['pyworld'] = types.ModuleType('pyworld')

# wetext fetches its rules from ModelScope, which may refuse; they ship
# with the install instead, so the lookup is pointed there
import wetext.wetext
wetext.wetext.snapshot_download = lambda *a, **k: os.path.join(root, 'wetext')

import torch
from cosyvoice.cli.cosyvoice import AutoModel

model = AutoModel(model_dir=os.path.join(root, 'model'))

# Each voice's reference, read once (its speaker features are kept)
loaded = set()


def voice(name):
    if name not in loaded:
        base = os.path.join(root, 'voices', name)
        with open(base + '.txt', encoding='utf-8') as f:
            words = f.read().strip()
        if not model.add_zero_shot_spk(words, base + '.wav', name):
            raise RuntimeError(f'voice {name} could not be read')
        loaded.add(name)
    return name


def speak(req):
    spk = voice(req.get('voice', 'female'))
    chunks = model.inference_zero_shot(req['text'], '', '', zero_shot_spk_id=spk, stream=False, speed=float(req.get('speed', 1)))
    wav = torch.cat([c['tts_speech'] for c in chunks], dim=1)[0]
    wav.numpy().astype('<f4').tofile(req['out'])
    return {'ok': True, 'rate': model.sample_rate, 'samples': int(wav.shape[0])}


if os.path.exists(sock_path):
    os.remove(sock_path)
server = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
server.bind(sock_path)
server.listen(8)
server.settimeout(IDLE)
print('ready', flush=True)
try:
    while True:
        try:
            conn, _ = server.accept()
        except socket.timeout:
            break
        with conn, conn.makefile('rwb') as f:
            for line in f:
                try:
                    reply = speak(json.loads(line))
                except Exception as e:  # the client gets the reason; the server stays up
                    traceback.print_exc()
                    reply = {'ok': False, 'error': str(e)}
                f.write((json.dumps(reply) + '\n').encode())
                f.flush()
finally:
    server.close()
    if os.path.exists(sock_path):
        os.remove(sock_path)
