const { app, BrowserWindow } = require('electron');

app.whenReady().then(() => {
  console.log('Creating test window...');
  const win = new BrowserWindow({
    width: 400,
    height: 300,
    title: 'Test Window'
  });
  
  win.loadURL('data:text/html;charset=utf-8,<html><body><h1>Test Window</h1><p>This should stay open</p></body></html>');
  
  win.on('closed', () => {
    console.log('Test window closed');
  });
  
  console.log('Test window created');
});