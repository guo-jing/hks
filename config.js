// GitHub Pages uses this public backend. An integrated deployment connects to its own origin.
window.HEX_SERVER_URL = 'wss://hex-heroes.onrender.com';
document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-open-room]').forEach(button=>button.addEventListener('click',()=>document.getElementById('room-dialog').showModal()));
});
