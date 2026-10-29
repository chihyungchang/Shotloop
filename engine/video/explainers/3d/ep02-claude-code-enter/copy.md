# 02 · What happens when you press Enter in Claude Code?

Step 1: the copy. Every fact below is quoted from its source; anything
we couldn't quote is listed under "Not used".

Second cut. The first one told this trip with abstract shapes (a
glowing capsule, a ring tunnel, a wireframe sphere) and didn't say
where the data actually goes. This one follows it through real places:
a person at a desk, the router, the internet provider, a cable on the
seabed, a data centre, the chips, the model, and back.

## Angle

People type into Claude Code and an answer appears; it also edits files
and runs commands. The trip in between is invisible: the prompt leaves
your desk with its context, crosses the internet (often an ocean),
gets read by a model running on AI chips in a data centre, and streams
back token by token. Sometimes what comes back is a request to do
something on your machine, which loops. That loop is the agent.

Audience: developers and the AI-curious. No account- or price-specific
claims.

## Hook

"You press Enter in Claude Code. Where does your prompt go?"

## Facts

| Claim in the video | Source wording (quoted) |
| --- | --- |
| Claude Code runs on your machine; it reads code, edits files, runs commands | "Claude Code is an agentic coding tool that reads your codebase, edits files, runs commands, and integrates with your development tools." (code.claude.com/docs/en) |
| It goes out over HTTPS to api.anthropic.com | "The Claude API is a RESTful API at `https://api.anthropic.com`" (platform.claude.com/docs/en/api/overview) |
| The request carries more than your prompt | "Everything in the request counts toward the context window: the system prompt, every message in `messages` (including tool results, images, and documents), and your tool definitions." (…/build-with-claude/context-windows) |
| Between continents, data rides undersea cables | TeleGeography: submarine cables account for "over 99%" of intercontinental data traffic, with the caveat that satellite traffic can't be measured precisely. (resources.telegeography.com/2023-mythbusting-part-3) |
| The data centre may be far away; not always the US | "`global` (default): inference may run in any available geography"; "`us`: inference runs only in US-based infrastructure". (platform.claude.com/docs/en/build-with-claude/data-residency) |
| The model runs on AI chips like GPUs and TPUs | Anthropic trains and runs Claude on "AWS Trainium, Google TPUs, and NVIDIA GPUs". (anthropic.com/news/google-broadcom-partnership-compute) |
| The answer streams back as it's written | "you can set `"stream": true` to incrementally stream the response using server-sent events (SSE)." (…/build-with-claude/streaming) |
| Sometimes the answer is a tool call, run on your side, result sent back | "Claude replies with a tool_use block naming the tool and its arguments. Your code runs the operation and sends back a `tool_result`." (…/agents-and-tools/tool-use/overview) |
| It asks before editing files or running commands | Manual mode asks for "[Bash commands:] Yes, except a built-in set of read-only commands. [File modification:] Yes." (code.claude.com/docs/en/permissions) |

Sources:
- https://code.claude.com/docs/en
- https://code.claude.com/docs/en/permissions
- https://platform.claude.com/docs/en/api/overview
- https://platform.claude.com/docs/en/build-with-claude/context-windows
- https://platform.claude.com/docs/en/build-with-claude/data-residency
- https://platform.claude.com/docs/en/build-with-claude/streaming
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/overview
- https://www.anthropic.com/news/google-broadcom-partnership-compute
- https://resources.telegeography.com/2023-mythbusting-part-3

Illustrative, and said so: the route drawn (one provider, one cable,
one data centre on the far shore), the model drawn as stacked layers,
and the text on the screen.

Not used, on purpose:
- "Your server is in the US": by default it may be anywhere; the
  caption says "possibly an ocean away".
- The TLS version, data retention, and "your whole repo isn't
  uploaded" (see the first cut's notes: no quotable source or too
  account-dependent).

## Takeaway

Claude Code is a loop between your machine and a model in a distant
data centre; anything that runs on your machine runs there because
Claude Code ran it, after asking where it's set to ask.

## Platform post

Caption:

> Your Claude Code prompt crosses an ocean before you see the answer.
> Then it might ask to run something on your machine. Sources in the
> video.

Hashtags: #claudecode #ai #coding #howtheinternetworks #techtok

On upload, switch on each platform's AI-generated content label.
Unofficial: the product's name describes it; no Anthropic logos or
brand marks.
