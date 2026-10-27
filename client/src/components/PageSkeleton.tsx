import type { CSSProperties } from "react";

// Bones are static placeholders rendered once while data loads, so index
// keys are safe: nothing here reorders or changes identity
const widths = (...ws: string[]): CSSProperties[] =>
  ws.map((width) => ({ width }));

const EXAMPLE_WIDTHS = widths("17rem", "22rem", "20rem");
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

export function PageSkeleton() {
  return (
    <div className="skeleton" aria-hidden="true">
      <nav className="examples">
        <span className="bone" style={{ width: "9rem", height: "0.9rem" }} />
        {EXAMPLE_WIDTHS.map((style, i) => (
          <span
            key={i}
            className="bone"
            style={{ ...style, height: "1.1rem" }}
          />
        ))}
      </nav>

      <p className="headline">
        <span
          className="bone"
          style={{ width: "70%", height: "1.25rem", marginBottom: "0.35rem" }}
        />
        <span className="bone" style={{ width: "45%", height: "1.25rem" }} />
      </p>

      <section className="summary">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="card">
            <span
              className="bone"
              style={{ width: "8rem", height: "0.85rem" }}
            />
            <span
              className="bone"
              style={{ width: "6rem", height: "1.75rem", marginTop: "0.5rem" }}
            />
          </div>
        ))}
      </section>

      <section className="breakdown">
        <div className="breakdown-header">
          <span className="bone" style={{ width: "11rem", height: "1.1rem" }} />
          <span
            className="bone"
            style={{ width: "9rem", height: "1.6rem", marginLeft: "auto" }}
          />
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
        <div className="results-header">
          <span className="bone" style={{ width: "9rem", height: "1.1rem" }} />
          <span
            className="bone"
            style={{ width: "7rem", height: "2rem", marginLeft: "auto" }}
          />
        </div>
        <div className="bone map-canvas" />
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
