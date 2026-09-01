window.AVATAR_CONFIG = {
  character: {
    displayName: "Avatar V1",
    defaultLook: "everyday",
    defaultBehavior: "default"
  },

  // A look owns its scene and its avatar state assets.
  // Missing assets intentionally fall back to the canonical image so the UI
  // can be built and tested before the final render set is dropped in.
  looks: {
    everyday: {
      label: "Everyday",
      subtitle: "Belly tee + frayed denim cutoffs",
      scene: "warm-home",
      ready: true,
      states: {
        idle: "assets/avatar-canonical.png",
        listening: "assets/avatar-canonical.png",
        thinking: "assets/avatar-canonical.png",
        speaking: "assets/avatar-canonical.png"
      }
    },
    mint: {
      label: "Mint",
      subtitle: "Mint dress + camel cutout heels",
      scene: "dressy-home",
      ready: false,
      states: {}
    },
    power: {
      label: "Power",
      subtitle: "Pinstripe skirt + Spiked Orbit heels",
      scene: "sharp-interior",
      ready: false,
      states: {}
    },
    cozy: {
      label: "Cozy",
      subtitle: "Oversized T-shirt, curled up on the couch",
      scene: "cozy-couch",
      ready: false,
      states: {}
    },
    poolside: {
      label: "Poolside",
      subtitle: "Favorite slate-gray one-piece",
      scene: "poolside",
      ready: false,
      special: true,
      states: {}
    }
  },

  scenes: {
    "warm-home": {
      label: "Warm home",
      className: "scene-warm-home"
    },
    "dressy-home": {
      label: "Dressy interior",
      className: "scene-dressy-home"
    },
    "sharp-interior": {
      label: "Sharp interior",
      className: "scene-sharp-interior"
    },
    "cozy-couch": {
      label: "Cozy couch",
      className: "scene-cozy-couch"
    },
    "poolside": {
      label: "Poolside",
      className: "scene-poolside"
    }
  },

  behaviors: {
    default: "Default",
    playful: "Playful",
    focused: "Focused",
    concise: "Concise"
  }
};
