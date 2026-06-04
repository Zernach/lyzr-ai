import { useState } from "react";
import { STAGES, type Applicant, type Stage } from "../types";
import ApplicantCard from "./ApplicantCard";

interface Props {
  applicants: Applicant[];
  draggable: boolean;
  onOpen: (a: Applicant) => void;
  onMove: (id: string, stage: Stage) => void;
}

export default function KanbanBoard({ applicants, draggable, onOpen, onMove }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<Stage | null>(null);

  const byStage = (stage: Stage) => applicants.filter((a) => a.stage === stage);

  const handleDrop = (stage: Stage) => {
    const id = draggingId;
    setOverStage(null);
    setDraggingId(null);
    if (id) {
      const current = applicants.find((a) => a.id === id);
      if (current && current.stage !== stage) onMove(id, stage);
    }
  };

  return (
    <div className="board">
      {STAGES.map((s) => {
        const cards = byStage(s.key);
        return (
          <section
            key={s.key}
            className={`column ${overStage === s.key ? "is-over" : ""}`}
            style={{ ["--rail" as string]: s.accent }}
            onDragOver={(e) => {
              if (!draggable) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (overStage !== s.key) setOverStage(s.key);
            }}
            onDragLeave={(e) => {
              // Only clear when leaving the column, not its children.
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setOverStage((cur) => (cur === s.key ? null : cur));
              }
            }}
            onDrop={() => draggable && handleDrop(s.key)}
          >
            <header className="column-head">
              <span className="column-dot" />
              <span className="column-label">{s.label}</span>
              <span className="column-count">{cards.length}</span>
            </header>
            <div className="column-blurb">{s.blurb}</div>

            <div className="column-body">
              {cards.map((a) => (
                <ApplicantCard
                  key={a.id}
                  applicant={a}
                  draggable={draggable}
                  dragging={draggingId === a.id}
                  onOpen={onOpen}
                  onDragStart={(card) => setDraggingId(card.id)}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverStage(null);
                  }}
                />
              ))}
              {cards.length === 0 && (
                <div className="column-empty">
                  {overStage === s.key ? "Drop here" : "—"}
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
