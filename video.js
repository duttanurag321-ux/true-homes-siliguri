const film = document.querySelector("video");
const toggle = document.querySelector(".controls button");
const portrait = matchMedia("(max-width: 700px) and (orientation: portrait)");
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
let pausedByVisitor = false;

function updateButton() {
  toggle.textContent = film.paused ? "Play film" : "Pause film";
}

function chooseFilm() {
  film.classList.remove("ready");
  toggle.hidden = true;
  film.src = portrait.matches ? film.dataset.tall : film.dataset.wide;
  if (!reducedMotion.matches && !pausedByVisitor) film.play().catch(updateButton);
}

film.addEventListener("loadeddata", () => {
  toggle.hidden = false;
  updateButton();
});
film.addEventListener("playing", () => {
  film.classList.add("ready");
  updateButton();
});
film.addEventListener("pause", updateButton);
film.addEventListener("error", () => {
  film.classList.remove("ready");
  toggle.hidden = true;
});
toggle.addEventListener("click", () => {
  pausedByVisitor = !film.paused;
  if (pausedByVisitor) film.pause();
  else film.play().catch(updateButton);
});
portrait.addEventListener("change", chooseFilm);
reducedMotion.addEventListener("change", chooseFilm);
chooseFilm();
