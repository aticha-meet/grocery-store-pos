#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
use std::{sync::Mutex, process::Child};
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

struct Backend(Mutex<Option<Child>>);
fn main() {
    let app = tauri::Builder::default()
        .manage(Backend(Mutex::new(None)))
        .setup(|app| {
            #[cfg(debug_assertions)]
            let url = "http://127.0.0.1:5173";
            #[cfg(not(debug_assertions))]
            let url = {
                use std::{fs, process::{Command, Stdio}, thread, time::{Duration, Instant}, net::TcpStream};
                use std::os::windows::process::CommandExt;
                let resources = app.path().resource_dir()?.join("app");
                let data = app.path().app_local_data_dir()?;
                fs::create_dir_all(&data)?;
                // Refuse an occupied port; do not attach this window to an unrelated service.
                if TcpStream::connect("127.0.0.1:3001").is_ok() {
                    return Err("Port 3001 is in use. Close the other POS instance before opening the desktop app.".into());
                }
                let log = fs::OpenOptions::new().create(true).append(true).open(data.join("server.log"))?;
                let mut child = Command::new(resources.join("node.exe"))
                    .arg("desktop/bootstrap.mjs")
                    .current_dir(&resources)
                    .env("POS_DATA_DIR", &data)
                    .env("PORT", "3001")
                    .env("POS_PARENT_PID", std::process::id().to_string())
                    .stdout(Stdio::from(log.try_clone()?))
                    .stderr(Stdio::from(log))
                    .creation_flags(0x08000000)
                    .spawn()?;
                let start = Instant::now();
                loop {
                    if child.try_wait()?.is_some() { return Err("POS backend could not start. See server.log in the app data directory.".into()); }
                    if TcpStream::connect("127.0.0.1:3001").is_ok() { break; }
                    if start.elapsed() > Duration::from_secs(30) { let _ = child.kill(); return Err("POS backend startup timed out.".into()); }
                    thread::sleep(Duration::from_millis(100));
                }
                *app.state::<Backend>().0.lock().unwrap() = Some(child);
                "http://127.0.0.1:3001"
            };
            WebviewWindowBuilder::new(app, "main", WebviewUrl::External(url.parse()?))
                .title("บ้านร้าน • POS")
                .inner_size(1440.0, 950.0)
                .min_inner_size(1024.0, 720.0)
                .build()?;
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Unable to start Baan Ran POS");
    app.run(|handle, event| {
        if let tauri::RunEvent::Exit = event {
            if let Some(mut child) = handle.state::<Backend>().0.lock().unwrap().take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    });
}
