/* ============================================
   PROYECTO: Consecuencias del uso de tecnología
   Archivo: main.js — Scripts generales
   ============================================ */

/* ---- Marcar enlace activo en la navegación ---- */
document.addEventListener('DOMContentLoaded', () => {
  const pagina = window.location.pathname.split('/').pop() || 'index.html';
  const enlaces = document.querySelectorAll('.nav-enlaces a');
  enlaces.forEach(a => {
    if (a.getAttribute('href') === pagina) {
      a.classList.add('activo');
    }
  });
});

/* ---- Animación de entrada para tarjetas ---- */
const observador = new IntersectionObserver((entradas) => {
  entradas.forEach(entrada => {
    if (entrada.isIntersecting) {
      entrada.target.style.opacity = '1';
      entrada.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.tarjeta, .estadistica-item').forEach(el => {
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
  observador.observe(el);
});
