import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { SuperWingsLocation } from "../types";

type GlobeExplorerProps = {
  locations: SuperWingsLocation[];
  selectedLocationId: string;
  onSelectLocation: (id: string) => void;
};

const earthRadius = 2.18;
const markerRadius = 0.055;
const earthTextureUrl = "/assets/earth-blue-marble-july.jpg";

export function GlobeExplorer({ locations, selectedLocationId, onSelectLocation }: GlobeExplorerProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0, 0.35, 6.15);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.enableRotate = true;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.55;
    controls.minDistance = 4.25;
    controls.maxDistance = 7.6;
    controls.rotateSpeed = 0.62;
    controls.zoomSpeed = 0.78;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;

    const rootGroup = new THREE.Group();
    rootGroup.rotation.x = -0.18;
    rootGroup.rotation.y = -0.62;
    scene.add(rootGroup);

    const markerByObjectId = new Map<number, string>();
    const selectedLocation = locations.find((location) => location.id === selectedLocationId) ?? locations[0];
    const selectedPoint = selectedLocation ? latLngToVector3(selectedLocation.coordinates.lat, selectedLocation.coordinates.lng, earthRadius) : null;

    const ambientLight = new THREE.AmbientLight(0xb9eaff, 1.4);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(-2.2, 3.1, 4.4);
    scene.add(ambientLight, keyLight);

    const glow = createAtmosphere();
    scene.add(glow);

    let earthTexture: THREE.Texture | null = null;
    let isDisposed = false;
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(earthRadius, 96, 96, -Math.PI / 2),
      new THREE.MeshPhongMaterial({
        color: 0x174c79,
        emissive: 0x020d1b,
        emissiveIntensity: 0.08,
        shininess: 26,
        specular: 0x365f82,
      }),
    );
    rootGroup.add(globe);

    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(
      earthTextureUrl,
      (texture) => {
        if (isDisposed) {
          texture.dispose();
          return;
        }

        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.ClampToEdgeWrapping;
        earthTexture = texture;

        const material = globe.material as THREE.MeshPhongMaterial;
        material.map = texture;
        material.color.set(0xffffff);
        material.emissive.set(0x010712);
        material.emissiveIntensity = 0.04;
        material.needsUpdate = true;
      },
      undefined,
      (error) => {
        console.error("Failed to load earth texture.", error);
      },
    );

    const grid = new THREE.Mesh(
      new THREE.SphereGeometry(earthRadius + 0.006, 48, 28),
      new THREE.MeshBasicMaterial({
        color: 0xd7f6ff,
        wireframe: true,
        transparent: true,
        opacity: 0.16,
      }),
    );
    rootGroup.add(grid);

    const routes = new THREE.Group();
    if (selectedLocation && selectedPoint) {
      for (const location of locations) {
        if (location.id === selectedLocation.id) {
          continue;
        }
        const target = latLngToVector3(location.coordinates.lat, location.coordinates.lng, earthRadius);
        routes.add(createRoute(selectedPoint, target));
      }
    }
    rootGroup.add(routes);

    const markers = new THREE.Group();
    for (const location of locations) {
      const point = latLngToVector3(location.coordinates.lat, location.coordinates.lng, earthRadius + 0.05);
      const isSelected = location.id === selectedLocationId;
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(isSelected ? markerRadius * 1.55 : markerRadius, 20, 20),
        new THREE.MeshBasicMaterial({ color: isSelected ? 0xffcf4a : 0xffffff }),
      );
      marker.position.copy(point);
      marker.userData.locationId = location.id;
      markerByObjectId.set(marker.id, location.id);
      markers.add(marker);

      const pulse = new THREE.Mesh(
        new THREE.RingGeometry(markerRadius * 1.7, markerRadius * 2.55, 36),
        new THREE.MeshBasicMaterial({
          color: isSelected ? 0xffcf4a : 0x8be9ff,
          transparent: true,
          opacity: isSelected ? 0.8 : 0.38,
          side: THREE.DoubleSide,
        }),
      );
      pulse.position.copy(point.clone().multiplyScalar(1.002));
      pulse.lookAt(new THREE.Vector3(0, 0, 0));
      pulse.userData.locationId = location.id;
      markerByObjectId.set(pulse.id, location.id);
      markers.add(pulse);
    }
    rootGroup.add(markers);

    const labels = createLabelLayer(mount, locations, rootGroup, camera);
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragState = { active: false, startX: 0, startY: 0 };
    let animationFrame = 0;

    const resize = () => {
      const rect = mount.getBoundingClientRect();
      const width = Math.max(320, rect.width);
      const height = Math.max(320, rect.height);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      labels.update();
    };

    const animate = () => {
      controls.update();
      routes.children.forEach((child, index) => {
        const material = (child as THREE.Line).material as THREE.LineBasicMaterial;
        material.opacity = 0.22 + Math.sin(Date.now() * 0.002 + index) * 0.08;
      });
      renderer.render(scene, camera);
      labels.update();
      animationFrame = window.requestAnimationFrame(animate);
    };

    const getPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        width: rect.width,
        height: rect.height,
      };
    };

    const handlePointerDown = (event: PointerEvent) => {
      const point = getPointer(event);
      dragState.active = true;
      dragState.startX = point.x;
      dragState.startY = point.y;
    };

    const handlePointerUp = (event: PointerEvent) => {
      if (!dragState.active) {
        return;
      }
      const point = getPointer(event);
      const moved = Math.abs(point.x - dragState.startX) + Math.abs(point.y - dragState.startY);
      dragState.active = false;

      if (moved > 8) {
        return;
      }

      pointer.x = (point.x / point.width) * 2 - 1;
      pointer.y = -(point.y / point.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObjects(markers.children, false)[0];
      if (hit) {
        const id = hit.object.userData.locationId ?? markerByObjectId.get(hit.object.id);
        if (typeof id === "string") {
          onSelectLocation(id);
        }
      }
    };

    resize();
    animate();
    window.addEventListener("resize", resize);
    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointercancel", handlePointerUp);

    return () => {
      isDisposed = true;
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointercancel", handlePointerUp);
      controls.dispose();
      labels.destroy();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          const material = object.material;
          if (Array.isArray(material)) {
            material.forEach((item) => item.dispose());
          } else {
            material.dispose();
          }
        }
      });
      earthTexture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [locations, selectedLocationId, onSelectLocation]);

  return (
    <div className="globe-wrap" ref={mountRef}>
      <div className="globe-hud" aria-hidden="true">
        <span>拖动旋转</span>
        <span>滚轮 / 双指缩放</span>
        <span>点击地点</span>
      </div>
    </div>
  );
}

function latLngToVector3(lat: number, lng: number, radius: number) {
  const latRad = THREE.MathUtils.degToRad(lat);
  const lngRad = THREE.MathUtils.degToRad(lng);
  const cosLat = Math.cos(latRad);
  return new THREE.Vector3(
    radius * cosLat * Math.sin(lngRad),
    radius * Math.sin(latRad),
    radius * cosLat * Math.cos(lngRad),
  );
}

function createRoute(start: THREE.Vector3, end: THREE.Vector3) {
  const control = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(earthRadius * 1.32);
  const curve = new THREE.QuadraticBezierCurve3(start, control, end);
  const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(42));
  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({
      color: 0xffd666,
      transparent: true,
      opacity: 0.28,
    }),
  );
}

function createAtmosphere() {
  return new THREE.Mesh(
    new THREE.SphereGeometry(earthRadius * 1.08, 64, 64),
    new THREE.MeshBasicMaterial({
      color: 0x48c8ff,
      transparent: true,
      opacity: 0.16,
      side: THREE.BackSide,
    }),
  );
}

function createLabelLayer(
  mount: HTMLDivElement,
  locations: SuperWingsLocation[],
  globe: THREE.Group,
  camera: THREE.PerspectiveCamera,
) {
  const labels = locations.map((location) => {
    const element = document.createElement("button");
    element.className = "globe-label";
    element.type = "button";
    element.textContent = location.nameZh;
    mount.appendChild(element);
    return {
      element,
      point: latLngToVector3(location.coordinates.lat, location.coordinates.lng, earthRadius + 0.13),
    };
  });

  return {
    update() {
      const rect = mount.getBoundingClientRect();
      globe.updateWorldMatrix(true, true);
      const globeMatrix = globe.matrixWorld;
      for (const label of labels) {
        const worldPoint = label.point.clone().applyMatrix4(globeMatrix);
        const normal = worldPoint.clone().normalize();
        const cameraDirection = camera.position.clone().sub(worldPoint).normalize();
        const visible = normal.dot(cameraDirection) > 0.06;
        const projected = worldPoint.project(camera);
        const x = (projected.x * 0.5 + 0.5) * rect.width;
        const y = (-projected.y * 0.5 + 0.5) * rect.height;
        label.element.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
        label.element.style.opacity = visible ? "1" : "0";
      }
    },
    destroy() {
      labels.forEach((label) => label.element.remove());
    },
  };
}
