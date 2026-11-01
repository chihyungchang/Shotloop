//! The commands the UI invokes (src/api.ts), by domain. Anything that
//! starts a process or waits on the disk runs off the main thread
//! (`blocking`), so the window never stalls.

pub mod ai;
pub mod app;
pub mod library;
pub mod media;
pub mod os;
pub mod projects;
