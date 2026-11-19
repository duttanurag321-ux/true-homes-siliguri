const menuButton = document.querySelector("#menu-button");
const menu = document.querySelector("#menu");

function setMenu(open) {
  menu.hidden = !open;
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Close menu" : "Open menu");
}
menuButton.addEventListener("click", () => setMenu(menu.hidden));
menu.addEventListener("click", () => setMenu(false));
document.addEventListener("keydown", event => {
  if (event.key === "Escape" && !menu.hidden) {
    setMenu(false);
    menuButton.focus();
  }
});

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
