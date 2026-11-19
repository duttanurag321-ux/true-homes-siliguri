const search = document.querySelector("#find-project");
const results = [...document.querySelectorAll(".results a")];
function filterProjects() {
  const words = search.value.toLowerCase().trim().split(/\s+/);
  for (const link of results) link.hidden = !words.every(word => link.dataset.terms.includes(word));
  document.querySelector("#empty-result").hidden = results.some(link => !link.hidden);
}
search.addEventListener("input", filterProjects);
for (const opener of document.querySelectorAll("[data-open]")) {
  opener.addEventListener("click", () => {
    const panel = document.getElementById(opener.dataset.open);
    panel.showModal();
    if (panel.contains(search)) {
      search.value = "";
      filterProjects();
      search.focus();
    }
  });
}
for (const panel of document.querySelectorAll("dialog")) {
  panel.addEventListener("click", event => {
    if (event.target.closest("a, .close")) panel.close();
  });
}

const texture = document.querySelector(".texture-film");
if (texture) {
  const control = document.querySelector(".texture-toggle");
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  let enabled = !reduced.matches;
  let visible = false;
  function updateTexture() {
    control.hidden = false;
    control.textContent = enabled ? "Pause texture" : "Play texture";
    if (enabled && visible && !document.hidden) {
      texture.play().catch(error => {
        if (error.name === "NotAllowedError") {
          enabled = false;
          control.textContent = "Play texture";
        }
      });
    } else texture.pause();
  }
  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    updateTexture();
  }).observe(texture);
  control.addEventListener("click", () => {enabled = !enabled; updateTexture();});
  reduced.addEventListener("change", () => {enabled = !reduced.matches; updateTexture();});
  document.addEventListener("visibilitychange", updateTexture);
}

for (const carousel of document.querySelectorAll("[data-carousel]")) {
  const track = carousel.querySelector(".track");
  const dots = [...carousel.querySelectorAll(".dots button")];
  const slides = [...track.children];
  let active = 0;

  function show(index) {
    active = (index + slides.length) % slides.length;
    const smooth = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    track.scrollTo({left: slides[active].offsetLeft - slides[0].offsetLeft,
                    behavior: smooth ? "smooth" : "instant"});
  }
  function sync() {
    active = Math.min(slides.length - 1, Math.round(track.scrollLeft / track.clientWidth));
    dots.forEach((dot, index) => dot.setAttribute("aria-pressed", String(index === active)));
    slides.forEach((slide, index) => { slide.inert = index !== active; });
  }
  carousel.querySelector(".prev").addEventListener("click", () => show(active - 1));
  carousel.querySelector(".next").addEventListener("click", () => show(active + 1));
  dots.forEach((dot, index) => dot.addEventListener("click", () => show(index)));
  track.addEventListener("keydown", event => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      show(active + (event.key === "ArrowLeft" ? -1 : 1));
    }
  });
  track.addEventListener("scroll", sync, {passive:true});
  window.addEventListener("resize", sync);
  sync();
}

const brief = document.querySelector("#brief");
if (brief) {
  brief.addEventListener("submit", event => {
    event.preventDefault();
    const project = brief.querySelector("#project").value;
    const purpose = brief.querySelector("#purpose").value;
    const notes = brief.querySelector("#notes").value.trim();
    const message = ["Hello True Homes,", "Project: " + project, "Request: " + purpose, notes].filter(Boolean).join("\n");
    const destination = new URL(brief.action);
    destination.searchParams.set("text", message);
    window.location.assign(destination.href);
  });
}
const worksheet = document.querySelector("#worksheet");
if (worksheet) {
  const currency = new Intl.NumberFormat("en-IN", {style:"currency", currency:"INR", maximumFractionDigits:2});
  worksheet.addEventListener("submit", event => event.preventDefault());
  worksheet.addEventListener("input", () => {
    const fields = [...worksheet.querySelectorAll("input")];
    const complete = fields.every(field => field.validity.valid);
    const sum = fields.reduce((total, field) => total + (field.valueAsNumber || 0), 0);
    document.querySelector("#subtotal").textContent = complete ? currency.format(sum) : "Check the entered amounts";
  });
}
