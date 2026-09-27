import { ArrowLeft, ArrowRight, Check, Wrench } from "lucide-react";
import { REPAIR_STEPS, REPAIR_WINDOWS, repairFade, type RepairDirection, type RepairState } from "./RepairRoutine";
import "./repair.css";

interface RepairOverlayProps {
  repair: RepairState;
  now: number;
  score: number;
  onCommand: (direction: RepairDirection) => void;
}

export function RepairOverlay({ repair, now, score, onCommand }: RepairOverlayProps) {
  const active = repair.phase === "command";
  const success = ["success", "depart", "return"].includes(repair.phase);
  const failed = repair.phase === "failure";
  const briefing = repair.phase === "briefing" || repair.phase === "reveal";
  const visible = repair.phase !== "blackout" && repair.phase !== "return";
  const remaining = Math.max(0, repair.phaseEnds - now);
  const sequence = repair.sequences[repair.round];

  return (
    <div className="repair-overlay" data-repair-phase={repair.phase}>
      {visible && <section className="repair-interface" aria-label="Emergency craft repair">
        <div className="repair-telemetry"><span>COCKPIT // EMERGENCY LINK</span><span>SCORE HELD · {score.toLocaleString()}</span></div>
        <header className="repair-heading">
          <p className="repair-eyebrow"><Wrench size={13} /> {success ? "PROPULSION RESTORED" : failed ? "CRITICAL FAILURE" : "HULL BREACH // MANUAL OVERRIDE"}</p>
          <h2>{success ? "Back in the fight." : failed ? "Repair failed." : "FIGHT FOR YOUR LIFE"}</h2>
          <p>{success ? "Returning to your run. 3 seconds of immunity on re-entry." : failed ? (repair.failure === "timeout" ? "Time expired. Transferring your flight record…" : "Incorrect command. Transferring your flight record…") : "Repair the damage to your craft by following the commands."}</p>
        </header>
        <div className="repair-console">
          <div className="repair-step-label"><span>{success ? "ALL SYSTEMS ONLINE" : `REPAIR ${repair.round + 1} / 3 · ${REPAIR_STEPS[repair.round]}`}</span><span>{active ? `${(remaining / 1000).toFixed(1)}s` : repair.phase === "stepComplete" ? "COMPLETE" : briefing ? "GET READY" : failed ? "OFFLINE" : "READY"}</span></div>
          <div className="repair-sequence" aria-label={active ? `Command sequence: ${sequence.join(", ")}` : "Repair progress"}>
            {sequence.map((direction, index) => <span key={`${repair.round}-${index}`} className={`repair-key ${index < repair.entered ? "is-entered" : active && index === repair.entered ? "is-next" : ""} ${failed && index === repair.entered ? "is-wrong" : ""}`} data-direction={direction} data-entered={index < repair.entered}>
              {index < repair.entered ? <Check aria-label="Correct" /> : direction === "left" ? <ArrowLeft aria-label="Left" /> : <ArrowRight aria-label="Right" />}
            </span>)}
          </div>
          <div className="repair-timer" role="progressbar" aria-label="Time left for command" aria-valuemin={0} aria-valuemax={100} aria-valuenow={active ? Math.round(remaining / REPAIR_WINDOWS[repair.round] * 100) : 0}><div style={{ width: `${active ? remaining / REPAIR_WINDOWS[repair.round] * 100 : briefing ? 100 : 0}%` }} /></div>
          <p className="repair-hint" role="status">{briefing ? `Follow the arrows from left to right. Starting in ${Math.ceil((remaining + (repair.phase === "reveal" ? 2400 : 0)) / 1000)}…` : active ? "Press each arrow once. One wrong input or timeout ends the run." : repair.phase === "stepComplete" ? "System repaired. Prepare for the next command…" : success ? "Engine stable. Rejoining your current session…" : "Your final score is saved for the scoring screen."}</p>
          <div className="repair-touch-controls">
            {(["left", "right"] as const).map(direction => <button key={direction} type="button" aria-label={`Repair ${direction}`} disabled={!active} onPointerDown={event => { if (event.button !== 0) return; event.preventDefault(); onCommand(direction); }} onClick={event => { if (event.detail === 0) onCommand(direction); }}>
              {direction === "left" ? <ArrowLeft /> : <ArrowRight />}<span>{direction}</span>
            </button>)}
          </div>
        </div>
      </section>}
      <div className="repair-blackout" style={{ opacity: repairFade(repair, now) }} />
    </div>
  );
}
