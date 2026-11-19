const film = document.querySelector("video");
const toggle = document.querySelector(".controls button");
const portrait = matchMedia("(max-width: 700px) and (orientation: portrait)");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let pausedByVisitor = false;

function updateButton() {
  toggle.textContent = film.paused ? "Play film" : "Pause film";
}

function playFilm() {
  film.play().catch(updateButton);
}

function chooseFilm() {
  film.classList.remove("ready");
  film.muted = true;
  film.playsInline = true;
  film.preload = "metadata";
  film.src = portrait.matches ? film.dataset.tall : film.dataset.wide;
  toggle.hidden = false;
  updateButton();
  if (!reducedMotion.matches && !pausedByVisitor) playFilm();
}

film.addEventListener("playing", () => {
  film.classList.add("ready");
  updateButton();
});
film.addEventListener("pause", updateButton);
film.addEventListener("error", () => {
  film.classList.remove("ready");
  toggle.textContent = "Retry film";
});
toggle.addEventListener("click", () => {
  if (film.paused || film.error) {
    pausedByVisitor = false;
    if (film.error) film.load();
    playFilm();
  } else {
    pausedByVisitor = true;
    film.pause();
  }
});
portrait.addEventListener("change", chooseFilm);
reducedMotion.addEventListener("change", chooseFilm);
chooseFilm();
