// User-supplied gallery organization is the canonical recording source.
// Crypto is an English-only recording shared by both portfolio languages.
export const projectMedia = {
  "hr": {
    "en": {
      "video": "./assets/gallery/videos/en/hr_en.mp4",
      "poster": "./assets/gallery/images/en/hr-dashboard.jpg",
      "language": "en",
      "recordingLanguage": "en",
      "duration": 17.739056
    },
    "vi": {
      "video": "./assets/gallery/videos/vi/hr_vn.mp4",
      "poster": "./assets/gallery/images/vi/hr-dashboard.jpg",
      "language": "vi",
      "recordingLanguage": "vi",
      "duration": 23.274967
    }
  },
  "crypto": {
    "en": {
      "video": "./assets/gallery/videos/cryptodashboard_demo.mp4",
      "poster": "./assets/gallery/images/en/crypto-comparison.jpg",
      "language": "shared",
      "recordingLanguage": "en",
      "duration": 25.083333
    },
    "vi": {
      "video": "./assets/gallery/videos/cryptodashboard_demo.mp4",
      "poster": "./assets/gallery/images/en/crypto-comparison.jpg",
      "language": "shared",
      "recordingLanguage": "en",
      "duration": 25.083333
    }
  },
  "contracts": {
    "en": {
      "video": "./assets/gallery/videos/en/contract_en.mp4",
      "poster": "./assets/gallery/images/en/contracts-dashboard.jpg",
      "language": "en",
      "recordingLanguage": "en",
      "duration": 19.079089
    },
    "vi": {
      "video": "./assets/gallery/videos/vi/contract_vi.mp4",
      "poster": "./assets/gallery/images/vi/contracts-dashboard.jpg",
      "language": "vi",
      "recordingLanguage": "vi",
      "duration": 11.5241
    }
  },
  "compressor": {
    "en": {
      "video": "./assets/gallery/videos/en/file_compressor_en.mp4",
      "poster": "./assets/gallery/images/en/compressor-main.jpg",
      "language": "en",
      "recordingLanguage": "en",
      "duration": 13.539133
    },
    "vi": {
      "video": "./assets/gallery/videos/vi/file_compressor_vn.mp4",
      "poster": "./assets/gallery/images/vi/compressor-main.jpg",
      "language": "vi",
      "recordingLanguage": "vi",
      "duration": 45.15
    }
  },
  "ceremony": {
    "en": {
      "video": "./assets/gallery/videos/en/gizikiicue_en.mp4",
      "poster": "./assets/gallery/images/en/ceremony-gallery.jpg",
      "language": "en",
      "recordingLanguage": "en",
      "duration": 12.966667
    },
    "vi": {
      "video": "./assets/gallery/videos/vi/gizikiicue_vn.mp4",
      "poster": "./assets/gallery/images/vi/ceremony-gallery.jpg",
      "language": "vi",
      "recordingLanguage": "vi",
      "duration": 8.966667
    }
  },
  "icue": {
    "en": {
      "video": "./assets/gallery/videos/en/icue-en.mp4",
      "poster": "./assets/gallery/images/en/icue-home.jpg",
      "language": "en",
      "recordingLanguage": "en",
      "duration": 12.138411
    },
    "vi": {
      "video": "./assets/gallery/videos/vi/icue-vn.mp4",
      "poster": "./assets/gallery/images/vi/icue-home.jpg",
      "language": "vi",
      "recordingLanguage": "vi",
      "duration": 18.1882
    }
  }
};
export function getProjectMedia(id,language='en') {
  if(!Object.hasOwn(projectMedia,id))return null;
  return projectMedia[id][language==='vi'?'vi':'en'];
}
