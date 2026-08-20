import { describe, expect, it } from "vitest";
import {
  MEMORY_CITATION_OPEN,
  extractMemoryCitationTrailer,
} from "../src/chat/memory-citations.js";

const trailer = `<oai-mem-citation>
<citation_entries>
MEMORY.md:1449-1465|note=[Used prior P2P link recording evidence routing]
rollout_summaries/prior.md:20-45|note=[Prior sidecar incident guided verification]
</citation_entries>
<rollout_ids>
019fcf92-6aa8-71d2-b503-9dbc27a54228
019fcff0-c2e7-7483-8342-280a7f97a806
</rollout_ids>
</oai-mem-citation>`;

describe("memory citation trailers", () => {
  it("extracts a valid terminal trailer while preserving structured provenance", () => {
    expect(extractMemoryCitationTrailer(`Answer.\n\n${trailer}\n`)).toEqual({
      text: "Answer.",
      memoryCitations: {
        entries: [
          {
            path: "MEMORY.md",
            lineStart: 1449,
            lineEnd: 1465,
            note: "Used prior P2P link recording evidence routing",
          },
          {
            path: "rollout_summaries/prior.md",
            lineStart: 20,
            lineEnd: 45,
            note: "Prior sidecar incident guided verification",
          },
        ],
        rolloutIds: [
          "019fcf92-6aa8-71d2-b503-9dbc27a54228",
          "019fcff0-c2e7-7483-8342-280a7f97a806",
        ],
      },
    });
  });

  it("accepts an empty rollout id section", () => {
    const raw = `${MEMORY_CITATION_OPEN}
<citation_entries>
MEMORY.md:1-1|note=[A local memory]
</citation_entries>
<rollout_ids>
</rollout_ids>
</oai-mem-citation>`;
    expect(extractMemoryCitationTrailer(raw).memoryCitations?.rolloutIds).toEqual([]);
  });

  it.each([
    `${trailer}\nvisible after`,
    trailer.replace("</oai-mem-citation>", ""),
    trailer.replace("MEMORY.md:1449-1465", "../MEMORY.md:1449-1465"),
    trailer.replace("019fcf92-6aa8-71d2-b503-9dbc27a54228", "not-a-rollout-id"),
    `Quoted example: ${MEMORY_CITATION_OPEN}`,
  ])("leaves malformed or non-terminal text visible", (raw) => {
    expect(extractMemoryCitationTrailer(raw)).toEqual({ text: raw });
  });
});
