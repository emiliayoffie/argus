import type { CSSProperties } from "react";

// Bones are static placeholders rendered once while data loads, so index
// keys are safe: nothing here reorders or changes identity
const widths = (...ws: string[]): CSSProperties[] =>
  ws.map((width) => ({ width }));

const BAR_WIDTHS = widths("100%", "62%", "38%", "15%");
const NAME_WIDTHS = widths(
  "85%",
  "60%",
  "75%",
  "90%",
  "70%",
  "80%",
  "65%",
  "78%",
);

function SectionHeadingBones() {
  return (
    <div className="section-heading">
      <span className="bone" style={{ width: "4rem", height: "0.8rem" }} />
      <span className="bone skel-h2" />
      <div className="section-sub skel-sub">
        <span className="bone" style={{ width: "60%", height: "0.85rem" }} />
      </div>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="skeleton" aria-hidden="true">
      <div className="headline-skel">
        <span className="bone" style={{ width: "72%", height: "0.95em" }} />
        <span className="bone" style={{ width: "46%", height: "0.95em" }} />
        <span
          className="bone skel-narrow"
          style={{ width: "88%", height: "0.95em" }}
        />
        <span
          className="bone skel-narrow"
          style={{ width: "54%", height: "0.95em" }}
        />
      </div>

      <section className="summary">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card">
            <div className="card-head">
              <span
                className="bone"
                style={{ width: "8rem", height: "0.8rem" }}
              />
            </div>
            <span className="bone skel-card-value" />
            {i === 2 && (
              <>
                <span
                  className="bone"
                  style={{ width: "100%", height: "8px" }}
                />
                <div className="skel-legend">
                  {Array.from({ length: 4 }, (_, j) => (
                    <span
                      key={j}
                      className="bone"
                      style={{ width: "70%", height: "1.9rem" }}
                    />
                  ))}
                </div>
              </>
            )}
            {i !== 2 && (
              <div className="skel-card-detail">
                <span
                  className="bone"
                  style={{ width: "70%", height: "0.8rem" }}
                />
              </div>
            )}
            {i === 3 && (
              <div className="skel-card-note">
                <span
                  className="bone"
                  style={{ width: "55%", height: "0.7rem" }}
                />
              </div>
            )}
          </div>
        ))}
      </section>

      <SectionHeadingBones />

      <section className="breakdown">
        <div className="breakdown-header">
          <span className="bone" style={{ width: "9rem", height: "1.6rem" }} />
          <span className="bone" style={{ width: "7rem", height: "1.6rem" }} />
        </div>
        <ol className="bars">
          {BAR_WIDTHS.map((style, i) => (
            <li key={i}>
              <div className="bar">
                <span
                  className="bone bar-label"
                  style={{ width: "6rem", height: "0.9rem" }}
                />
                <span className="bar-track">
                  <span
                    className="bone bar-fill"
                    style={{ ...style, height: "100%" }}
                  />
                </span>
                <span
                  className="bone bar-value"
                  style={{ width: "4rem", height: "0.9rem" }}
                />
              </div>
            </li>
          ))}
        </ol>
      </section>

      <section className="results">
        <SectionHeadingBones />
        <div className="bone map-canvas" />
      </section>

      <section className="results">
        <SectionHeadingBones />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {widths("80%", "60%", "60%", "60%", "50%", "40%", "50%").map(
                  (style, i) => (
                    <th key={i}>
                      <span
                        className="bone"
                        style={{ ...style, height: "0.85rem" }}
                      />
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {NAME_WIDTHS.map((style, i) => (
                <tr key={i}>
                  <td>
                    <span
                      className="bone"
                      style={{ ...style, height: "0.9rem" }}
                    />
                    <span
                      className="bone"
                      style={{
                        width: "35%",
                        height: "0.75rem",
                        marginTop: "0.25rem",
                      }}
                    />
                  </td>
                  {widths("55%", "45%", "50%", "45%", "30%", "45%").map(
                    (s, j) => (
                      <td key={j}>
                        <span
                          className="bone"
                          style={{ ...s, height: "0.85rem" }}
                        />
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
