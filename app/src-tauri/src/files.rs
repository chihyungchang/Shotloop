//! Files the shell writes (settings, usage counts, the AI's usage, a
//! project's text files): always whole, under a temporary name in the same
//! folder and then renamed over the old one, so a crash, a full disk or a
//! second writer never leaves half a file behind.

use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

// Two writers of the same file in this process get their own temporary files
static NEXT: AtomicU64 = AtomicU64::new(0);

fn temp_name(path: &Path) -> std::io::Result<PathBuf> {
    let name = path.file_name().ok_or_else(|| std::io::Error::other(format!("{} has no file name", path.display())))?;
    let n = NEXT.fetch_add(1, Ordering::Relaxed);
    Ok(path.with_file_name(format!("{}.{}-{n}.tmp", name.to_string_lossy(), std::process::id())))
}

/// `bytes` as the whole of `path`; `private` makes it readable by the
/// user only from the first byte (the settings hold API keys)
pub fn write_atomic(path: &Path, bytes: &[u8], private: bool) -> std::io::Result<()> {
    let tmp = temp_name(path)?;
    let written = (|| {
        let mut options = std::fs::OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(if private { 0o600 } else { 0o644 });
        }
        let mut f = options.open(&tmp)?;
        f.write_all(bytes)?;
        f.sync_all()?;
        std::fs::rename(&tmp, path)
    })();
    if written.is_err() {
        // The temporary file is ours and useless now; the error that matters is returned
        let _ = std::fs::remove_file(&tmp);
    }
    written
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn writes_whole_files_and_leaves_no_temporary_one() {
        let dir = std::env::temp_dir().join(format!("shotloop-files-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join("a.json");
        write_atomic(&file, b"one", true).unwrap();
        write_atomic(&file, b"two", true).unwrap();
        assert_eq!(std::fs::read_to_string(&file).unwrap(), "two");
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            assert_eq!(std::fs::metadata(&file).unwrap().permissions().mode() & 0o777, 0o600);
        }
        let left: Vec<_> = std::fs::read_dir(&dir).unwrap().flatten().map(|e| e.file_name()).collect();
        assert_eq!(left, vec![std::ffi::OsString::from("a.json")]);
        // A missing folder fails and leaves nothing
        assert!(write_atomic(&dir.join("missing/b.json"), b"x", false).is_err());
        std::fs::remove_dir_all(dir).ok();
    }
}
