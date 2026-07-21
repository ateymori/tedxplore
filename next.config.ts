import type { NextConfig } from "next";

import { PREVIEW_PATH_PREFIX } from "./src/config/routes";

const nextConfig: NextConfig = {
  cacheComponents: true,

  async headers() {
    return [
      {
        /**
         * FR-27: no preview response may be indexed — neither the owner's
         * (`/preview/draft/…`) nor a tokenized link (`/preview/[token]`).
         *
         * The pages also set the `robots` meta tag, and the duplication is
         * deliberate: the header reaches crawlers that never parse the HTML,
         * and it survives a page that forgets its metadata. Anchored to the
         * prefix constant so a route rename cannot leave the rule behind.
         */
        source: `${PREVIEW_PATH_PREFIX}/:path*`,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      },
    ];
  },
};

export default nextConfig;
