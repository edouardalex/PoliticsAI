import { useCallback, useEffect, useMemo, useState } from 'react';
import { MISSIONS, MODEL, type Mission } from '../content/measures';
import {
  computeSimulation,
  evaluateMission,
  encodeSimState,
  decodeSimState,
  hydrateMeasures,
  buildCustomMeasure,
  type ActiveMeasure,
  type ScenarioId,
  type CustomMeasureInput,
} from '../lib/simulation';
import MissionPicker from './simulator/MissionPicker';
import Dashboard from './simulator/Dashboard';
import Trajectories from './simulator/Trajectories';
import Catalog from './simulator/Catalog';
import Bill from './simulator/Bill';
import CustomMeasureModal from './simulator/CustomMeasureModal';
import ResultsOverlay from './simulator/ResultsOverlay';
import HypothesesModal from './simulator/HypothesesModal';
import CollabWall from './simulator/CollabWall';
import { collabAvailable, type RecentBudget } from '../lib/collab';

interface Props {
  sim: string | null;
  onSimChange: (s: string | null) => void;
  onToast: (msg: string) => void;
}

const SCENARIO_LABELS: Record<ScenarioId, string> = {
  prudent: 'Prudent',
  central: 'Central',
  haut: 'Haut',
};

export default function SimulatorView({ sim, onSimChange, onToast }: Props) {
  const [initial] = useState(() => (sim ? decodeSimState(sim) : null));
  const [missionId, setMissionId] = useState<string | null>(() =>
    initial && MISSIONS.some((m) => m.id === initial.mission) ? initial.mission : null,
  );
  const [measures, setMeasures] = useState<ActiveMeasure[]>(() =>
    initial ? hydrateMeasures(initial) : [],
  );
  const [scenario, setScenario] = useState<ScenarioId>(() =>
    initial && initial.scenario in SCENARIO_LABELS ? initial.scenario : 'central',
  );
  const [customOpen, setCustomOpen] = useState(false);
  const [resultsOpen, setResultsOpen] = useState(false);
  const [hypoOpen, setHypoOpen] = useState(false);
  const [wallOpen, setWallOpen] = useState(false);
  const [wallOk, setWallOk] = useState(false);

  useEffect(() => {
    collabAvailable().then(setWallOk);
  }, []);

  const mission: Mission | null = useMemo(
    () => MISSIONS.find((m) => m.id === missionId) ?? null,
    [missionId],
  );

  const result = useMemo(() => computeSimulation(measures, scenario), [measures, scenario]);
  const evaluation = useMemo(
    () => (mission ? evaluateMission(mission, result) : null),
    [mission, result],
  );

  // Synchronise l'état vers l'URL (via App)
  useEffect(() => {
    if (!missionId) {
      onSimChange(null);
      return;
    }
    onSimChange(
      encodeSimState({
        mission: missionId,
        scenario,
        measures: measures.filter((m) => !m.isCustom).map((m) => ({ id: m.def.id, i: m.intensity })),
        custom: measures.filter((m) => m.isCustom && m.customInput).map((m) => m.customInput!),
      }),
    );
  }, [missionId, measures, scenario, onSimChange]);

  const handleAdd = useCallback((m: ActiveMeasure) => {
    setMeasures((prev) => (prev.some((x) => x.uid === m.uid) ? prev : [...prev, m]));
  }, []);

  const handleRemove = useCallback((uid: string) => {
    setMeasures((prev) => prev.filter((m) => m.uid !== uid));
  }, []);

  const handleIntensity = useCallback((uid: string, intensity: number) => {
    setMeasures((prev) => prev.map((m) => (m.uid === uid ? { ...m, intensity } : m)));
  }, []);

  const handleCustom = useCallback(
    (input: CustomMeasureInput) => {
      const built = buildCustomMeasure(input);
      if (built) {
        setMeasures((prev) => [...prev, built]);
        onToast('Votre mesure est au projet de loi');
      }
      setCustomOpen(false);
    },
    [onToast],
  );

  const reset = useCallback(() => {
    setMeasures([]);
    setResultsOpen(false);
  }, []);

  const openBudget = useCallback((b: RecentBudget) => {
    setMissionId(MISSIONS.some((m) => m.id === b.mission) ? b.mission : 'libre');
    if (b.scenario === 'prudent' || b.scenario === 'central' || b.scenario === 'haut') {
      setScenario(b.scenario);
    }
    setMeasures(hydrateMeasures({ mission: b.mission, scenario: 'central', measures: b.measures, custom: [] }));
    setWallOpen(false);
    setResultsOpen(false);
  }, []);

  if (!mission) {
    return (
      <>
        <MissionPicker
          onPick={(id) => setMissionId(id)}
          onHypotheses={() => setHypoOpen(true)}
          hypoOpen={hypoOpen}
          onCloseHypo={() => setHypoOpen(false)}
          onWall={wallOk ? () => setWallOpen(true) : undefined}
        />
        <CollabWall open={wallOpen} onClose={() => setWallOpen(false)} onOpenBudget={openBudget} />
      </>
    );
  }

  return (
    <div className="simu">
      <div className="simu-missionbar">
        <button
          className="crumb-back"
          onClick={() => {
            setMissionId(null);
            setResultsOpen(false);
          }}
        >
          ← Missions
        </button>
        <div className="smb-main">
          <span className="smb-title">{mission.title}</span>
          <span className="smb-goals">
            {evaluation?.sandbox
              ? 'Bac à sable — composez librement'
              : mission.goals.map((g) => g.label).join(' · ')}
          </span>
        </div>
        <div className="smb-actions">
          <div className="scenario-switch" role="radiogroup" aria-label="Scénario de multiplicateurs">
            {(Object.keys(SCENARIO_LABELS) as ScenarioId[]).map((s) => (
              <button
                key={s}
                role="radio"
                aria-checked={scenario === s}
                className={`ms${scenario === s ? ' active' : ''}`}
                onClick={() => setScenario(s)}
                title={`Multiplicateurs × ${MODEL.scenarios[s]}`}
              >
                {SCENARIO_LABELS[s]}
              </button>
            ))}
          </div>
          {wallOk && (
            <button className="btn-ghost" onClick={() => setWallOpen(true)}>
              Le mur
            </button>
          )}
          <button className="btn-ghost" onClick={() => setHypoOpen(true)}>
            Hypothèses
          </button>
          <button className="btn-primary btn-present" onClick={() => setResultsOpen(true)}>
            Présenter mon budget
          </button>
        </div>
      </div>

      <Dashboard result={result} mission={mission} />

      <div className="simu-grid">
        <Catalog
          active={measures}
          sandbox={mission.id === 'libre'}
          onAdd={handleAdd}
          onCustom={() => setCustomOpen(true)}
        />
        <Trajectories result={result} />
        <Bill
          measures={measures}
          scenario={scenario}
          result={result}
          onRemove={handleRemove}
          onIntensity={handleIntensity}
          onCustom={() => setCustomOpen(true)}
        />
      </div>

      <p className="simu-footnote">
        Simulation mécanique au premier ordre — ordres de grandeur, pas prédictions. Multiplicateurs
        scénario « {SCENARIO_LABELS[scenario]} » (× {MODEL.scenarios[scenario]}), bouclage fiscal{' '}
        {Math.round(MODEL.poRate * 100)} %, loi d'Okun {MODEL.okun}.{' '}
        <button className="btn-link" onClick={() => setHypoOpen(true)}>
          Toutes les hypothèses
        </button>
      </p>

      <CustomMeasureModal
        open={customOpen}
        sandbox={mission.id === 'libre'}
        onClose={() => setCustomOpen(false)}
        onSubmit={handleCustom}
      />
      <HypothesesModal open={hypoOpen} onClose={() => setHypoOpen(false)} />
      <CollabWall open={wallOpen} onClose={() => setWallOpen(false)} onOpenBudget={openBudget} />
      {resultsOpen && evaluation && (
        <ResultsOverlay
          mission={mission}
          result={result}
          evaluation={evaluation}
          measures={measures}
          scenarioLabel={SCENARIO_LABELS[scenario]}
          scenarioId={scenario}
          onClose={() => setResultsOpen(false)}
          onReset={reset}
          onToast={onToast}
          onOpenWall={() => {
            setResultsOpen(false);
            setWallOpen(true);
          }}
        />
      )}
    </div>
  );
}
