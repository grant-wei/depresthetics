export function About() {
  return (
    <main className="about">
      <div className="about__content">
        <h1 className="about__title">about</h1>
        <p className="about__text">
          a place looked like this, a moment felt like that, and then
          it was over. depresthetics is a collection of those moments —
          my late twenties on film.
        </p>
        <p className="about__text">
          film enforces a constraint i need: thirty-six exposures and
          whatever the light gives you. no retakes. the photos get
          chosen and arranged, but the moments themselves are
          unrecoverable. that's the thing worth keeping.
        </p>
        <p className="about__text">
          the grain, the blown highlights, the frames where nothing
          quite lines up. those aren't mistakes. they're what it
          actually looked like to be there.
        </p>
        <p className="about__text about__text--details">
          mostly shot on olympus xa2 using kodak ultramax 400,
          fujifilm 400, and ilford hp5.
        </p>
        <div className="about__links">
          <a
            href="https://grantgpt.io"
            target="_blank"
            rel="noopener noreferrer"
            className="about__link"
          >
            grantgpt.io
          </a>
        </div>
      </div>
    </main>
  );
}
