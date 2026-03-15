const { app, BrowserWindow, screen, dialog } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');

// Configure logging
autoUpdater.logger = require("electron-log");
autoUpdater.logger.transports.file.level = "info";

function createWindow() {
    // Create the browser window.
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    const mainWindow = new BrowserWindow({
        width: Math.round(width * 0.9),
        height: Math.round(height * 0.9),
        minWidth: 1024,
        minHeight: 768,
        title: 'Guarujá GeoMap Intelligence',
        icon: path.join(__dirname, 'logo.png'), // Ensure logo.png exists in root or assets
        webPreferences: {
            nodeIntegration: false, // Security best practice
            contextIsolation: true, // Security best practice
            preload: path.join(__dirname, 'preload.js') // Optional, if needed later
        },
        autoHideMenuBar: true, // Native app feel
        show: false // Wait until ready-to-show to prevent white flash
    });

    // Load the local index.html with ABSOLUTE path to avoid white screen
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    // Optimize Window Appearance
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.focus();
    });
}

// App Lifecycle
app.whenReady().then(() => {
    createWindow();

    // Check for updates
    autoUpdater.checkForUpdatesAndNotify();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

// Auto Updater Events
autoUpdater.on('update-available', () => {
    // dialog.showMessageBox({ type: 'info', title: 'Atualização', message: 'Uma nova versão está sendo baixada...' });
});

autoUpdater.on('update-downloaded', () => {
    dialog.showMessageBox({
        type: 'info',
        title: 'Atualização Pronta',
        message: 'Nova versão baixada. O aplicativo será reiniciado para atualizar.',
        buttons: ['Reiniciar Agora']
    }).then(() => {
        autoUpdater.quitAndInstall();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});
