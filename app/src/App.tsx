import { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import TopBar from './components/TopBar';
import SankeyView from './components/SankeyView';
import SimulatorView from './components/SimulatorView';
import MobileFlow from './components/MobileFlow';
import DetailPanel from './components/DetailPanel';
import EuropeView from './components/EuropeView';
import TableView from './components/TableView';
import SearchPalette, { type SearchPick } from './components/SearchPalette';
import AboutModal from './components/AboutModal';
import IntroOverlay from './components/IntroOverlay';
import { getPerimeter, FRANCE, type PerimeterId } from './lib/data';
import { DEFAULT_STATE, parseHash, writeHash, shareUrl, type AppState, type ViewId } from './lib/urlState';
import { REDUCED_MOTION } from './lib/motionPrefs';
import type { DisplayMode } from './lib/format';

function useMedia(query: string): boolean {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const cb = () => setMatch(mq.matches);
    mq.addEventListener('change', cb);
    return () => mq.removeEventListener('change', cb);
  }, [query]);
  return match;
}

export default function App() {
  const [state, setState] = useState<AppState>(() => {
    const fromHash = parseHash(window.location.hash);
    const seen = fromHash.seen || sessionStorage.getItem('pai-seen') === '1';
    return { ...DEFAULT_STATE, ...fromHash, seen };
  });
  const [searchOpen, setSearchOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isMobile = useMedia('(max-width: 719px)');
  const perimeter = useMemo(() => getPerimeter(state.perimeter), [state.perimeter]);

  const patch = useCallback((p: Partial<AppState>) => {
    setState((s) => ({ ...s, ...p }));
  }, []);

  const onSimChange = useCallback((sim: string | null) => {
    setState((s) => (s.sim === sim ? s : { ...s, sim }));
  }, []);

  useEffect(() => {
    writeHash(state);
  }, [state]);

  // Liens profonds pendant la session (back/forward, hash modifié à la main)
  useEffect(() => {
    const onHash = () => {
      const p = parseHash(window.location.hash);
      if (Object.keys(p).length > 0) setState((s) => ({ ...s, ...p }));
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (state.seen) sessionStorage.setItem('pai-seen', '1');
  }, [state.seen]);

  // Raccourcis clavier globaux
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((o) => !o);
        return;
      }
      if (e.key === 'Escape') {
        if (searchOpen) setSearchOpen(false);
        else if (aboutOpen) setAboutOpen(false);
        else if (state.selected) patch({ selected: null });
        else if (state.zoom) patch({ zoom: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, aboutOpen, state.selected, state.zoom, patch]);

  const notify = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  }, []);

  const share = useCallback(async () => {
    const url = shareUrl(state);
    try {
      if (isMobile && navigator.share) {
        await navigator.share({ title: 'PoliticsAI — le budget public, enfin lisible', url });
        return;
      }
      await navigator.clipboard.writeText(url);
      notify('Lien copié — cette vue exacte est partageable');
    } catch {
      notify(url);
    }
  }, [state, isMobile, notify]);

  const onSearchPick = useCallback(
    (pick: SearchPick) => {
      patch({
        view: 'explore',
        zoom: pick.parent ?? null,
        selected: pick.id,
        seen: true,
      });
    },
    [patch],
  );

  const setPerimeter = (p: PerimeterId) => patch({ perimeter: p, zoom: null, selected: null });
  const setMode = (m: DisplayMode) => patch({ mode: m });
  const setView = (v: ViewId) => patch({ view: v, selected: null });

  return (
    <>
      <AnimatePresence>
        {!state.seen && (
          <IntroOverlay onEnter={() => patch({ seen: true })} onAbout={() => setAboutOpen(true)} />
        )}
      </AnimatePresence>

      <TopBar
        perimeter={state.perimeter}
        mode={state.mode}
        view={state.view}
        onPerimeter={setPerimeter}
        onMode={setMode}
        onView={setView}
        onSearch={() => setSearchOpen(true)}
        onShare={share}
        onAbout={() => setAboutOpen(true)}
      />

      <main className="main-area" data-panel={state.view === 'explore' && !!state.selected}>
        {state.view === 'explore' &&
          (isMobile ? (
            <MobileFlow
              perimeter={perimeter}
              perimeterId={state.perimeter}
              mode={state.mode}
              zoom={state.zoom}
              selected={state.selected}
              onSelect={(id) => patch({ selected: id })}
              onZoom={(z) => patch({ zoom: z, selected: null })}
            />
          ) : (
            <SankeyView
              perimeter={perimeter}
              perimeterId={state.perimeter}
              mode={state.mode}
              zoom={state.zoom}
              selected={state.selected}
              onSelect={(id) => patch({ selected: id })}
              onZoom={(z) => patch({ zoom: z, selected: null })}
            />
          ))}

        {state.view === 'simu' && (
          <SimulatorView sim={state.sim} onSimChange={onSimChange} onToast={notify} />
        )}

        {state.view === 'europe' && (
          <EuropeView
            perimeter={state.perimeter}
            onInspect={(code) => patch({ view: 'explore', zoom: null, selected: code })}
          />
        )}

        {state.view === 'table' && <TableView perimeter={perimeter} perimeterId={state.perimeter} />}
      </main>

      {state.view === 'explore' && (
        <DetailPanel
          perimeter={perimeter}
          perimeterId={state.perimeter}
          mode={state.mode}
          selected={state.selected}
          onClose={() => patch({ selected: null })}
          onZoom={(z) => patch({ zoom: z, selected: null })}
          onSelect={(id) => patch({ selected: id })}
          onShare={share}
        />
      )}

      <footer className="footer">
        <span>
          PoliticsAI <em>bêta</em> — le budget public, enfin lisible. Données Eurostat/Insee,
          millésime {perimeter.year}, extraction {FRANCE.meta.extracted}.
        </span>
        <span className="footer-links">
          <button className="btn-link" onClick={() => setAboutOpen(true)}>
            Méthode &amp; sources
          </button>
          <a href="https://github.com/edouardalex/PoliticsAI" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </span>
      </footer>

      <SearchPalette
        perimeter={perimeter}
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onPick={onSearchPick}
      />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} />

      <AnimatePresence>
        {toast && (
          <motion.div
            className="toast"
            initial={REDUCED_MOTION ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={REDUCED_MOTION ? undefined : { opacity: 0, y: 10 }}
            role="status"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
