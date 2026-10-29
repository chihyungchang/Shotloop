//! The menu bar icon: a template S (design/logo/tray.svg) with the number
//! of active jobs beside it, and a menu with the queue's state, Show
//! Shotloop and Quit. The UI sends the menu's words in its language
//! (set_tray_text); English until it does.

use std::sync::Mutex;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::{TrayIcon, TrayIconBuilder};
use tauri::{AppHandle, Emitter, Manager, Wry};
use tauri_plugin_notification::NotificationExt;

pub struct Tray {
    icon: TrayIcon,
    status: MenuItem<Wry>,
    show: MenuItem<Wry>,
    update: MenuItem<Wry>,
    /// The same item in the app menu (Shotloop → Check for Updates…)
    app_update: Option<MenuItem<Wry>>,
    quit: MenuItem<Wry>,
    /// The finished alert's words, {n} and {f} filled in; from the UI
    done: Mutex<(String, String)>,
}

pub fn create(app: &AppHandle) -> tauri::Result<Tray> {
    let status = MenuItem::with_id(app, "status", "Nothing running", false, None::<&str>)?;
    let show = MenuItem::with_id(app, "show", "Show Shotloop", true, None::<&str>)?;
    let update = MenuItem::with_id(app, CHECK_UPDATE, "Check for Updates…", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Shotloop", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&status, &PredefinedMenuItem::separator(app)?, &show, &update, &quit])?;
    let icon = TrayIconBuilder::with_id("main")
        .icon(tauri::include_image!("icons/tray.png"))
        .icon_as_template(true)
        .tooltip("Shotloop")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show" => show_main(app),
            "quit" => app.exit(0),
            CHECK_UPDATE => check_update(app),
            _ => {}
        })
        .build(app)?;
    let done = Mutex::new(("{n} jobs finished".into(), "{n} jobs finished, {f} failed".into()));
    let app_update = app_menu(app).ok();
    Ok(Tray { icon, status, show, update, app_update, quit, done })
}

pub const CHECK_UPDATE: &str = "check-update";

/// The app menu: the system's default, with Check for Updates… under
/// About Shotloop
fn app_menu(app: &AppHandle) -> tauri::Result<MenuItem<Wry>> {
    let menu = Menu::default(app)?;
    let item = MenuItem::with_id(app, CHECK_UPDATE, "Check for Updates…", true, None::<&str>)?;
    if let Some(tauri::menu::MenuItemKind::Submenu(first)) = menu.items()?.first() {
        first.insert_items(&[&item, &PredefinedMenuItem::separator(app)?], 1)?;
    }
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        if event.id().as_ref() == CHECK_UPDATE {
            check_update(app)
        }
    });
    Ok(item)
}

/// The window comes forward and the UI checks (Settings → About)
fn check_update(app: &AppHandle) {
    show_main(app);
    let _ = app.emit(CHECK_UPDATE, ());
}

/// Bring the main window back (it hides rather than closes)
pub fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// The number of running and queued jobs beside the icon; nothing when idle
pub fn set_count(app: &AppHandle, n: usize) {
    if let Some(t) = app.try_state::<Tray>() {
        let _ = t.icon.set_title(if n > 0 { Some(n.to_string()) } else { None });
    }
}

#[tauri::command]
pub fn set_tray_text(app: AppHandle, status: String, show: String, quit: String, done: Option<String>, failed: Option<String>, update: Option<String>) {
    if let Some(t) = app.try_state::<Tray>() {
        let _ = t.status.set_text(status);
        let _ = t.show.set_text(show);
        if let Some(u) = update {
            let _ = t.update.set_text(&u);
            if let Some(a) = &t.app_update {
                let _ = a.set_text(&u);
            }
        }
        let _ = t.quit.set_text(quit);
        if let (Some(d), Some(f)) = (done, failed) {
            *t.done.lock().unwrap() = (d, f);
        }
    }
}

/// When the queue runs dry: a system sound and a notification, as chosen
/// in Settings → General
pub fn batch_finished(app: &AppHandle, launch: &crate::queue::Launch, n: usize, failed: usize) {
    if n == 0 {
        return;
    }
    if launch.notify_sound {
        let sound = if failed > 0 { "Basso" } else { "Glass" };
        let _ = std::process::Command::new("afplay").arg(format!("/System/Library/Sounds/{sound}.aiff")).spawn();
    }
    if launch.notify_desktop {
        let Some(t) = app.try_state::<Tray>() else { return };
        let (done, fail) = t.done.lock().unwrap().clone();
        let text = if failed > 0 { fail } else { done };
        let body = text.replace("{n}", &n.to_string()).replace("{f}", &failed.to_string());
        let _ = app.notification().builder().title("Shotloop").body(body).show();
    }
}

/// Settings → General's "Try it": the alert as the queue would give it now
#[tauri::command]
pub fn test_alert(app: AppHandle) {
    let launch = app.state::<crate::App>().queue.launch.lock().unwrap().clone();
    let on = crate::queue::Launch { notify_sound: true, notify_desktop: true, ..launch };
    batch_finished(&app, &on, 1, 0);
}
