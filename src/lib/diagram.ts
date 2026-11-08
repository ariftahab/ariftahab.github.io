import { z } from "astro/zod";

// System diagram shown on a project page. See src/components/Diagram.astro for how it is drawn.
export const diagramSchema = z.object({
  cols: z.number(), // number of grid columns
  width: z.number().optional(), // SVG width in px (default 720); wider = smaller text
  caption: z.string().optional(),
  nodes: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      sub: z.string().optional(), // small second line
      col: z.number(), // 0-based
      row: z.number(), // 0-based
      span: z.number().optional(), // columns this node covers
      hl: z.boolean().optional(), // highlight (green border)
      store: z.boolean().optional(), // data store (rounded)
    }),
  ),
  edges: z
    .array(
      z.object({
        from: z.string(),
        to: z.string(),
        label: z.string().optional(),
        dashed: z.boolean().optional(),
        both: z.boolean().optional(), // arrowheads on both ends
        dir: z.enum(["h", "v"]).optional(), // force leaving from left/right (h) or top/bottom (v)
      }),
    )
    .optional(),
  groups: z
    .array(
      z.object({
        label: z.string(),
        cols: z.tuple([z.number(), z.number()]), // first and last column, inclusive
        rows: z.tuple([z.number(), z.number()]),
      }),
    )
    .optional(),
});

export type Diagram = z.infer<typeof diagramSchema>;
