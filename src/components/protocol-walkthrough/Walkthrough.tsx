import { useEffect, useState, useSyncExternalStore } from "react";
import { stories } from "./stories";
import { FlowMap } from "./FlowMap";

const subscribe = (fn: () => void) => {
  window.addEventListener("hashchange", fn);
  return () => window.removeEventListener("hashchange", fn);
};
const motionPreference = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (fn: () => void) => {
  const media = window.matchMedia(motionPreference);
  media.addEventListener("change", fn);
  return () => media.removeEventListener("change", fn);
};
function Player({ story }: { story: (typeof stories)[number] }) {
  const reduce = useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(motionPreference).matches,
    () => false,
  );
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [paused, setPaused] = useState(false);
  const last = story.frames.length - 1;
  const frame = story.frames[step];
  useEffect(() => {
    if (!playing || step === last) return;
    const timer = window.setTimeout(() => setStep(step + 1), 6500);
    return () => window.clearTimeout(timer);
  }, [playing, step, last]);
  const change = (next: number) => {
    setPlaying(false);
    setPaused(false);
    setStep(next);
  };
  const auto = playing && step < last;
  const toggle = () => {
    if (auto) {
      setPlaying(false);
      setPaused(true);
    } else {
      if (step === last) setStep(0);
      setPaused(false);
      setPlaying(true);
    }
  };
  return (
    <>
      <div className='walk-grid'>
        <figure>
          <figcaption>{story.context}</figcaption>
          <FlowMap frame={frame} still={reduce || paused} />
        </figure>
        <div
          className='walk-detail'
          aria-live={auto ? "off" : "polite"}
          aria-atomic='true'
        >
          <p className='walk-count'>
            Step {step + 1} of {last + 1}
          </p>
          <h3>{frame.title}</h3>
          <p>{frame.detail}</p>
          <p className='walk-value'>{frame.value}</p>
        </div>
      </div>
      <div
        className='walk-controls'
        role='group'
        aria-label='Walkthrough playback'
      >
        <button type='button' className='walk-play' onClick={toggle}>
          {auto ? "Pause" : step === last ? "Replay" : "Play"}
        </button>
        <button
          type='button'
          aria-label='Previous step'
          disabled={step === 0}
          onClick={() => change(step - 1)}
        >
          ← Back
        </button>
        <button
          type='button'
          aria-label='Next step'
          disabled={step === last}
          onClick={() => change(step + 1)}
        >
          Next →
        </button>
      </div>
      <div className='walk-sources'>
        {story.sources.map(([label, href]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
      </div>
    </>
  );
}
export function ProtocolWalkthrough() {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => "",
  );
  const story =
    stories.find(({ id }) => hash === "#walkthrough-" + id) ?? stories[0];
  return (
    <section
      className='site-paper walk'
      id='walkthrough'
      aria-labelledby='walk-title'
    >
      <h2 id='walk-title'>Walk through the protocol</h2>
      <p className='walk-intro'>
        Follow a message, a coin or a vote. Each illustration plays locally
        using an example.
      </p>
      <nav aria-label='Choose a protocol walkthrough' className='walk-topics'>
        {stories.map(({ id, label }) => (
          <a
            key={id}
            id={"walkthrough-" + id}
            href={"#walkthrough-" + id}
            aria-current={story.id === id ? "true" : undefined}
          >
            {label}
          </a>
        ))}
      </nav>
      <Player key={story.id} story={story} />
      <noscript>
        <h3>Walkthrough transcripts</h3>
        {stories.map((s) => (
          <section key={s.id}>
            <h4>
              {s.label} · {s.context}
            </h4>
            <ol>
              {s.frames.map((f) => (
                <li key={f.title}>
                  <strong>{f.title}.</strong> {f.detail}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </noscript>
    </section>
  );
}
