/* ============================================
   PROYECTO: Consecuencias del uso de tecnología
   Archivo: main.js — Interactividad futurista
   ============================================ */

/* ---- Canvas de partículas ---- */
(function iniciarCanvas() {
  const canvas = document.createElement('canvas');
  canvas.id = 'canvas-fondo';
  document.body.insertBefore(canvas, document.body.firstChild);

  const ctx = canvas.getContext('2d');
  let particulas = [];
  const NUM_PARTICULAS = 80;
  const DISTANCIA_MAX = 140;

  function ajustarTamano() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  class Particula {
    constructor() {
      this.reiniciar();
    }

    reiniciar() {
      this.x  = Math.random() * canvas.width;
      this.y  = Math.random() * canvas.height;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
      this.r  = Math.random() * 1.5 + 0.5;
      this.alpha = Math.random() * 0.4 + 0.1;
      this.esCian = Math.random() > 0.45;
    }

    actualizar() {
      this.x += this.vx;
      this.y += this.vy;
      if (this.x < 0 || this.x > canvas.width)  this.vx *= -1;
      if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
    }

    dibujar() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fillStyle = this.esCian
        ? `rgba(0,212,255,${this.alpha})`
        : `rgba(168,85,247,${this.alpha})`;
      ctx.fill();
    }
  }

  function crearParticulas() {
    particulas = [];
    for (let i = 0; i < NUM_PARTICULAS; i++) {
      particulas.push(new Particula());
    }
  }

  function conectarParticulas() {
    for (let i = 0; i < particulas.length; i++) {
      for (let j = i + 1; j < particulas.length; j++) {
        const dx = particulas[i].x - particulas[j].x;
        const dy = particulas[i].y - particulas[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < DISTANCIA_MAX) {
          const opacidad = (1 - dist / DISTANCIA_MAX) * 0.18;
          const usaCian = particulas[i].esCian && particulas[j].esCian;
          ctx.beginPath();
          ctx.strokeStyle = usaCian
            ? `rgba(0,212,255,${opacidad})`
            : `rgba(168,85,247,${opacidad * 0.8})`;
          ctx.lineWidth = 0.7;
          ctx.moveTo(particulas[i].x, particulas[i].y);
          ctx.lineTo(particulas[j].x, particulas[j].y);
          ctx.stroke();
        }
      }
    }
  }

  function animar() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particulas.forEach(p => { p.actualizar(); p.dibujar(); });
    conectarParticulas();
    requestAnimationFrame(animar);
  }

  ajustarTamano();
  crearParticulas();
  animar();

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => { ajustarTamano(); crearParticulas(); }, 200);
  });
})();

/* ---- Efecto spotlight en tarjetas ---- */
document.addEventListener('mousemove', (e) => {
  document.querySelectorAll('.tarjeta').forEach(tarjeta => {
    const rect = tarjeta.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    tarjeta.style.setProperty('--mx', `${x}%`);
    tarjeta.style.setProperty('--my', `${y}%`);
  });
});

/* ---- Menú hamburguesa ---- */
document.addEventListener('DOMContentLoaded', () => {
  const btn  = document.querySelector('.nav-menu-btn');
  const menu = document.querySelector('.nav-enlaces');
  if (btn && menu) {
    btn.addEventListener('click', () => {
      menu.classList.toggle('abierto');
      const abierto = menu.classList.contains('abierto');
      btn.setAttribute('aria-expanded', abierto);
      btn.querySelectorAll('span').forEach((s, i) => {
        if (abierto) {
          if (i === 0) s.style.transform = 'translateY(7px) rotate(45deg)';
          if (i === 1) s.style.opacity   = '0';
          if (i === 2) s.style.transform = 'translateY(-7px) rotate(-45deg)';
        } else {
          s.style.transform = '';
          s.style.opacity   = '';
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove('abierto');
        btn.querySelectorAll('span').forEach(s => {
          s.style.transform = '';
          s.style.opacity   = '';
        });
      }
    });
  }
});

/* ---- Enlace activo en la navegación ---- */
document.addEventListener('DOMContentLoaded', () => {
  const pagina  = window.location.pathname.split('/').pop() || 'index.html';
  const enlaces = document.querySelectorAll('.nav-enlaces a');
  enlaces.forEach(a => {
    if (a.getAttribute('href') === pagina) a.classList.add('activo');
  });
});

/* ---- Animaciones de revelado al hacer scroll ---- */
const observadorReveal = new IntersectionObserver((entradas) => {
  entradas.forEach(entrada => {
    if (entrada.isIntersecting) {
      entrada.target.classList.add('visible');
      observadorReveal.unobserve(entrada.target);
    }
  });
}, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

document.querySelectorAll('.reveal, .reveal-izq').forEach(el => {
  observadorReveal.observe(el);
});

/* ---- Contadores animados ---- */
function animarContador(el) {
  const objetivo = el.dataset.objetivo || el.textContent.trim();
  const num      = parseFloat(objetivo.replace(/[^\d.]/g, ''));
  const sufijo   = objetivo.replace(/[\d.]/g, '');
  const prefijo  = objetivo.startsWith('+') ? '+' : '';
  const esDec    = objetivo.includes('.');
  const dur      = 2000;
  let  inicio    = null;

  function paso(ts) {
    if (!inicio) inicio = ts;
    const prog = Math.min((ts - inicio) / dur, 1);
    const ease = 1 - Math.pow(1 - prog, 3);
    const val  = num * ease;
    el.textContent = prefijo + (esDec ? val.toFixed(1) : Math.floor(val)) + sufijo;
    if (prog < 1) requestAnimationFrame(paso);
  }

  requestAnimationFrame(paso);
}

const observadorContador = new IntersectionObserver((entradas) => {
  entradas.forEach(entrada => {
    if (entrada.isIntersecting) {
      animarContador(entrada.target);
      observadorContador.unobserve(entrada.target);
    }
  });
}, { threshold: 0.5 });

document.querySelectorAll('.estadistica-numero').forEach(el => {
  observadorContador.observe(el);
});

/* ---- Barras de progreso animadas ---- */
const observadorBarras = new IntersectionObserver((entradas) => {
  entradas.forEach(entrada => {
    if (entrada.isIntersecting) {
      const barra = entrada.target;
      const pct   = barra.dataset.pct || '0';
      setTimeout(() => { barra.style.width = pct + '%'; }, 200);
      observadorBarras.unobserve(barra);
    }
  });
}, { threshold: 0.3 });

document.querySelectorAll('.barra-relleno').forEach(b => {
  observadorBarras.observe(b);
});

/* ---- Color de glow en estadísticas según color inline ---- */
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.estadistica-numero').forEach(el => {
    const color = el.style.color;
    const item  = el.closest('.estadistica-item');
    if (item && color) item.style.setProperty('--glow-color', color);
  });
});

/* ---- Efecto scanline suave sobre el hero ---- */
document.addEventListener('DOMContentLoaded', () => {
  const hero = document.querySelector('.hero');
  if (!hero) return;

  const scanline = document.createElement('div');
  scanline.style.cssText = `
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(0,212,255,0.15), transparent);
    pointer-events: none;
    z-index: 2;
    animation: escanear 8s linear infinite;
  `;
  hero.appendChild(scanline);
});

/* ---- Cursor personalizado sutil ---- */
document.addEventListener('DOMContentLoaded', () => {
  const cursor = document.createElement('div');
  cursor.style.cssText = `
    position: fixed;
    width: 8px; height: 8px;
    border-radius: 50%;
    background: rgba(0,212,255,0.8);
    box-shadow: 0 0 12px rgba(0,212,255,0.6);
    pointer-events: none;
    z-index: 9999;
    transform: translate(-50%, -50%);
    transition: transform 0.1s, opacity 0.3s;
    opacity: 0;
  `;

  const anillo = document.createElement('div');
  anillo.style.cssText = `
    position: fixed;
    width: 30px; height: 30px;
    border-radius: 50%;
    border: 1px solid rgba(0,212,255,0.3);
    pointer-events: none;
    z-index: 9998;
    transform: translate(-50%, -50%);
    transition: left 0.15s ease, top 0.15s ease, opacity 0.3s;
    opacity: 0;
  `;

  document.body.appendChild(cursor);
  document.body.appendChild(anillo);

  let mouseX = 0, mouseY = 0;

  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX; mouseY = e.clientY;
    cursor.style.left  = mouseX + 'px';
    cursor.style.top   = mouseY + 'px';
    cursor.style.opacity = '1';
    anillo.style.left  = mouseX + 'px';
    anillo.style.top   = mouseY + 'px';
    anillo.style.opacity = '1';
  });

  document.addEventListener('mouseleave', () => {
    cursor.style.opacity = '0';
    anillo.style.opacity = '0';
  });

  document.querySelectorAll('a, button, .tarjeta').forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(2)';
      anillo.style.transform = 'translate(-50%, -50%) scale(1.5)';
      anillo.style.borderColor = 'rgba(0,212,255,0.6)';
    });
    el.addEventListener('mouseleave', () => {
      cursor.style.transform = 'translate(-50%, -50%) scale(1)';
      anillo.style.transform = 'translate(-50%, -50%) scale(1)';
      anillo.style.borderColor = 'rgba(0,212,255,0.3)';
    });
  });
});

/* ---- Mapa corporal interactivo ---- */
const DATOS_CUERPO = {
  ojos: {
    icono: '👁️',
    titulo: 'Ojos — Síndrome Visual Digital',
    color: '#FF4D6D',
    nivel: 'Alto riesgo',
    desc: 'Las pantallas reducen el parpadeo de 15-20 veces por minuto a solo 3-4 veces, provocando resequedad severa, tensión ocular y daño a la córnea a largo plazo.',
    lista: [
      'Síndrome visual por computadora (CVS)',
      'Ojos secos y enrojecimiento crónico',
      'Visión borrosa y dificultad para enfocar',
      'Sensibilidad a la luz (fotofobia)',
      'Dolores de cabeza de origen ocular'
    ]
  },
  cerebro: {
    icono: '🧠',
    titulo: 'Cerebro — Sobreestimulación digital',
    color: '#A855F7',
    nivel: 'Crítico',
    desc: 'El flujo constante de notificaciones mantiene al cerebro en estado de alerta permanente, agotando el sistema nervioso y reduciendo la capacidad de concentración profunda.',
    lista: [
      'Reducción de la capacidad de concentración',
      'Fatiga cognitiva acumulada',
      'Dificultad para el pensamiento crítico',
      'Alteración del ciclo de sueño (melatonina)',
      'Sobreproducción de cortisol (estrés)'
    ]
  },
  cuello: {
    icono: '🦴',
    titulo: 'Cuello — Tech Neck',
    color: '#FFB800',
    nivel: 'Crónico',
    desc: 'Al inclinar la cabeza 60° hacia el celular, el cuello soporta hasta 27 kg de presión. Con el tiempo, esto genera daño vertebral irreversible en la columna cervical.',
    lista: [
      'Dolor cervical crónico',
      'Compresión de discos intervertebrales',
      'Tensión severa en músculos trapecio',
      'Cefaleas tensionales frecuentes',
      'En casos graves: hernia cervical'
    ]
  },
  corazon: {
    icono: '🫀',
    titulo: 'Sistema cardiovascular — Sedentarismo',
    color: '#FF4D6D',
    nivel: 'Muy alto riesgo',
    desc: 'Permanecer inmóvil horas frente a pantallas reduce el gasto energético, eleva la presión arterial y dispara el riesgo de enfermedades del corazón desde edades tempranas.',
    lista: [
      'Aumento del riesgo cardiovascular',
      'Presión arterial elevada',
      'Riesgo elevado de diabetes tipo 2',
      'Mala circulación y retención de líquidos',
      'Aumento de peso y obesidad abdominal'
    ]
  },
  columna: {
    icono: '🦴',
    titulo: 'Columna lumbar — Daño postural',
    color: '#FF4D6D',
    nivel: 'Alto riesgo',
    desc: 'Sentarse durante horas con postura incorrecta comprime los discos intervertebrales lumbares y debilita progresivamente la musculatura de soporte de la espalda.',
    lista: [
      'Dolor lumbar crónico',
      'Escoliosis postural adquirida',
      'Compresión de nervios (ciática)',
      'Hernia de disco lumbar',
      'Atrofia de la musculatura paravertebral'
    ]
  },
  munecas: {
    icono: '🤲',
    titulo: 'Manos y muñecas — Lesiones RSI',
    color: '#FFB800',
    nivel: 'Moderado',
    desc: 'Los movimientos repetitivos al escribir y deslizar en pantallas inflaman tendones y comprimen el nervio mediano en el túnel carpiano, generando dolor crónico.',
    lista: [
      'Síndrome del túnel carpiano',
      '"WhatsApp thumb" — tendinitis en el pulgar',
      'Codo de ratón (epicondilitis lateral)',
      'Tendinitis en muñecas',
      'Entumecimiento y hormigueo en dedos'
    ]
  },
  piernas: {
    icono: '🦵',
    titulo: 'Piernas — Circulación y sedentarismo',
    color: '#00D4FF',
    nivel: 'Moderado',
    desc: 'Pasar horas sentado reduce el flujo sanguíneo en las extremidades inferiores, favorece la formación de coágulos y acelera la aparición de várices a edades jóvenes.',
    lista: [
      'Mala circulación venosa crónica',
      'Riesgo de trombosis venosa profunda',
      'Aparición temprana de várices',
      'Atrofia muscular progresiva',
      'Calambres y entumecimiento frecuentes'
    ]
  }
};

document.addEventListener('DOMContentLoaded', () => {
  const hotspots  = document.querySelectorAll('.hotspot');
  const panel     = document.querySelector('.cuerpo-panel');
  if (!hotspots.length || !panel) return;

  const panelVacio = panel.querySelector('.cuerpo-panel-vacio');
  const panelInfo  = panel.querySelector('.cuerpo-panel-info');

  function mostrarDato(id) {
    const datos = DATOS_CUERPO[id];
    if (!datos) return;

    hotspots.forEach(h => h.classList.remove('activo'));
    document.querySelectorAll(`.hotspot[data-id="${id}"]`).forEach(h => h.classList.add('activo'));
    document.querySelectorAll(`.cuerpo-btn-zona`).forEach(b => {
      b.classList.toggle('activo', b.dataset.id === id);
    });

    panel.style.borderColor = datos.color + '55';
    panel.classList.add('tiene-dato');
    panelVacio.style.display = 'none';
    panelInfo.style.display  = 'block';

    panelInfo.innerHTML = `
      <span class="cuerpo-panel-icono">${datos.icono}</span>
      <div class="cuerpo-panel-titulo" style="color:${datos.color}">${datos.titulo}</div>
      <span class="cuerpo-panel-nivel" style="color:${datos.color}; border-color:${datos.color}">${datos.nivel}</span>
      <p class="cuerpo-panel-desc">${datos.desc}</p>
      <ul class="cuerpo-panel-lista" style="--li-color:${datos.color}">
        ${datos.lista.map(item => `<li style="--li-color:${datos.color}"><span style="color:${datos.color}">▸</span> ${item}</li>`).join('')}
      </ul>
    `;
  }

  hotspots.forEach(hs => {
    hs.addEventListener('click', () => mostrarDato(hs.dataset.id));
  });

  document.querySelectorAll('.cuerpo-btn-zona').forEach(btn => {
    btn.addEventListener('click', () => mostrarDato(btn.dataset.id));
  });

  /* Mostrar el primer hotspot por defecto */
  mostrarDato('ojos');
});
