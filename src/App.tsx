import { useMemo, useState } from "react";
import locationsData from "./data/locations.json";
import type { SuperWingsLocation } from "./types";
import { GlobeExplorer } from "./components/GlobeExplorer";

const locations = locationsData as SuperWingsLocation[];
const allRegionsLabel = "全部地区";
const allTagsLabel = "全部主题";

function App() {
  const [selectedId, setSelectedId] = useState(locations[0]?.id ?? "");
  const [region, setRegion] = useState(allRegionsLabel);
  const [tag, setTag] = useState(allTagsLabel);

  const regions = useMemo(
    () => [allRegionsLabel, ...Array.from(new Set(locations.map((location) => location.region)))],
    [],
  );

  const tags = useMemo(
    () => [allTagsLabel, ...Array.from(new Set(locations.flatMap((location) => location.tags)))],
    [],
  );

  const filteredLocations = useMemo(
    () =>
      locations.filter((location) => {
        const regionMatches = region === allRegionsLabel || location.region === region;
        const tagMatches = tag === allTagsLabel || location.tags.includes(tag);
        return regionMatches && tagMatches;
      }),
    [region, tag],
  );

  const selectedLocation =
    filteredLocations.find((location) => location.id === selectedId) ??
    filteredLocations[0] ??
    locations[0];

  const handleRegionChange = (nextRegion: string) => {
    setRegion(nextRegion);
    const nextLocation = locations.find((location) => {
      const regionMatches = nextRegion === allRegionsLabel || location.region === nextRegion;
      const tagMatches = tag === allTagsLabel || location.tags.includes(tag);
      return regionMatches && tagMatches;
    });
    if (nextLocation) {
      setSelectedId(nextLocation.id);
    }
  };

  const handleTagChange = (nextTag: string) => {
    setTag(nextTag);
    const nextLocation = locations.find((location) => {
      const regionMatches = region === allRegionsLabel || location.region === region;
      const tagMatches = nextTag === allTagsLabel || location.tags.includes(nextTag);
      return regionMatches && tagMatches;
    });
    if (nextLocation) {
      setSelectedId(nextLocation.id);
    }
  };

  return (
    <main className="app-shell">
      <section className="map-stage" aria-label="超级飞侠地点探索地图">
        <header className="topbar">
          <div>
            <p className="eyebrow">原创旅行探索风格</p>
            <h1>超级飞侠地点探索地图</h1>
          </div>
          <div className="stats" aria-label="当前地点数量">
            <strong>{filteredLocations.length}</strong>
            <span>/ {locations.length} 个地点</span>
          </div>
        </header>

        <div className="content-grid">
          <section className="globe-panel" aria-label="3D 地球和地点标记">
            <GlobeExplorer
              locations={filteredLocations}
              selectedLocationId={selectedLocation.id}
              onSelectLocation={setSelectedId}
            />
          </section>

          <aside className="side-panel" aria-label="地点筛选和详情">
            <div className="filters" aria-label="筛选">
              <label>
                <span>地区</span>
                <select value={region} onChange={(event) => handleRegionChange(event.target.value)}>
                  {regions.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>主题</span>
                <select value={tag} onChange={(event) => handleTagChange(event.target.value)}>
                  {tags.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <LocationCard location={selectedLocation} />

            <div className="location-list" aria-label="地点列表">
              {filteredLocations.map((location) => (
                <button
                  className={location.id === selectedLocation.id ? "location-chip active" : "location-chip"}
                  key={location.id}
                  type="button"
                  onClick={() => setSelectedId(location.id)}
                >
                  <span>{location.nameZh}</span>
                  <small>{location.countryZh}</small>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}

function LocationCard({ location }: { location: SuperWingsLocation }) {
  const episodeMeta = [
    location.episode.season ? `第 ${location.episode.season} 季` : null,
    location.episode.episode ? `第 ${location.episode.episode} 集` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="detail-card">
      <div className="detail-heading">
        <div>
          <p className="eyebrow">{location.region} · {location.countryZh}</p>
          <h2>{location.nameZh}</h2>
          {location.nameEn ? <p className="name-en">{location.nameEn}</p> : null}
        </div>
        <div className="coords" aria-label="经纬度">
          <span>{location.coordinates.lat.toFixed(2)}°</span>
          <span>{location.coordinates.lng.toFixed(2)}°</span>
        </div>
      </div>

      <section className="episode-card" aria-label="动画集数信息">
        <p className="episode-meta">{episodeMeta || "样例集数待校对"}</p>
        <h3>{location.episode.titleZh}</h3>
        <p>{location.episode.summaryZh}</p>
        {location.episode.watchUrl ? (
          <a href={location.episode.watchUrl} target="_blank" rel="noreferrer">
            外部观看链接
          </a>
        ) : null}
      </section>

      <section className="fact-box" aria-label="趣味地理信息">
        <h3>探索小知识</h3>
        <p>{location.funFactZh}</p>
      </section>

      <div className="tag-row" aria-label="地点标签">
        {location.tags.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    </article>
  );
}

export default App;
