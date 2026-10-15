const menuButton=document.querySelector('.menu-toggle');
const navigation=document.querySelector('#navigation');
const productMenu=document.querySelector('.product-menu');
const dialog=document.querySelector('#build-dialog');
function closeMenu(){menuButton.setAttribute('aria-expanded','false');navigation.classList.remove('open');productMenu.open=false;}
menuButton.addEventListener('click',()=>{const open=menuButton.getAttribute('aria-expanded')!=='true';menuButton.setAttribute('aria-expanded',String(open));navigation.classList.toggle('open',open);});
navigation.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
document.addEventListener('click',e=>{if(!e.target.closest('.product-menu'))productMenu.open=false;if(!e.target.closest('.nav-shell'))closeMenu();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();}});
document.querySelectorAll('[data-build]').forEach(b=>b.addEventListener('click',()=>{closeMenu();dialog.showModal();}));
document.querySelector('.dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',e=>{const r=dialog.getBoundingClientRect();if(e.target===dialog&&(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom))dialog.close();});
