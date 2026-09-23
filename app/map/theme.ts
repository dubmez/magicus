// The demo's palette and type, shared by every /map screen. Inline styles on
// purpose, as in the shared header: nothing in the product's stylesheet can move them.

export const C = {
  bg: "#F7FAF2",
  ink: "#3B4953",
  sage: "#547863",
  sageMid: "#90AB8B",
  surface: "#EBF4DD",
  rule: "#E3EAD8",
  white: "#FFFFFF",
  coral: "#E8553E",
  coralWash: "#FDEBE7",
};

export const SANS = "var(--font-dm-sans), system-ui, sans-serif";
export const SERIF = "var(--font-dm-serif), Georgia, serif";

export const button = {
  primary: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    padding: "0 22px",
    borderRadius: 10,
    fontFamily: SANS,
    fontSize: 15,
    fontWeight: 500,
    textDecoration: "none",
    background: C.coral,
    color: C.white,
    border: "none",
    cursor: "pointer",
  },
  quiet: {
    fontFamily: SANS,
    fontSize: 14,
    fontWeight: 500,
    color: C.sage,
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    textDecoration: "none",
  },
} as const;
