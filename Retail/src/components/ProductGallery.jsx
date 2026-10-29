'use client';
import { useState } from 'react';
import Glasses from './Glasses';

// Main photo with thumbnails. Falls back to the placeholder artwork when a frame has no photo.
export default function ProductGallery({ images = [], alt = '' }) {
  const [i, setI] = useState(0);
  const list = images.filter(Boolean);
  const cur = list[Math.min(i, list.length - 1)];
  return (
    <div className="pd-gal">
      <div className="photo pd-gal__main">
        {cur ? <img src={cur} alt={alt} fetchPriority="high" /> : <Glasses />}
      </div>
      {list.length > 1 && (
        <div className="pd-gal__th" role="group" aria-label="Photos">
          {list.map((src, k) => (
            <button key={src + k} type="button" className={`photo pd-gal__t${k === i ? ' is-on' : ''}`} onClick={() => setI(k)} aria-label={`Show photo ${k + 1}`} aria-pressed={k === i}>
              <img src={src} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
