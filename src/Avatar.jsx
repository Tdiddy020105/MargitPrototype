import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";

const MODEL_URL = "/models/margit.glb";

const CLIP_HINTS = {
  wave: ["wave", "waving", "hello", "greet"],
  idle: ["idle", "stand", "breath", "rest"],
  talk: ["talk", "speak", "gesture", "explain"],
  cheer: ["victory", "cheer", "motiv", "celebrat"]
};

function pickClip(clips, hints) {
  for (const hint of hints) {
    const clip = clips.find((item) => item.name.toLowerCase().includes(hint));
    if (clip) return clip;
  }
  return null;
}

export default function Avatar({ pose, listening }) {
  const mountRef = useRef(null);
  const poseRef = useRef(pose);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    poseRef.current = pose;
  }, [pose]);

  useEffect(() => {
    const mount = mountRef.current;
    let disposed = false;
    let frame = 0;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
    scene.add(new THREE.HemisphereLight(0xfff4e8, 0xc8b79a, 1.15));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(1.2, 2.2, 2.4);
    scene.add(key);

    const mixerHolder = { mixer: null, actions: {}, current: "" };

    function resize() {
      const width = mount.clientWidth || 280;
      const height = mount.clientHeight || 340;
      renderer.setSize(width, height, false);
      camera.aspect = width / Math.max(height, 1);
      camera.updateProjectionMatrix();
    }

    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    resize();

    function play(name) {
      if (mixerHolder.current === name) return;
      const next = mixerHolder.actions[name] || mixerHolder.actions.idle;
      const previous = mixerHolder.actions[mixerHolder.current];
      if (next && previous !== next) {
        if (previous) previous.fadeOut(0.35);
        next.reset().fadeIn(0.35).play();
      }
      mixerHolder.current = name;
    }

    const loader = new GLTFLoader();
    loader.load(
      MODEL_URL,
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;
        scene.add(model);
        const box = new THREE.Box3().setFromObject(model);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const distance = size.y / (2 * Math.tan((camera.fov * Math.PI) / 360));
        camera.position.set(center.x, center.y, center.z + distance * 1.45);
        camera.near = Math.max(distance / 100, 0.01);
        camera.far = distance * 20;
        camera.lookAt(center);
        camera.updateProjectionMatrix();

        const clips = gltf.animations || [];
        const mixer = new THREE.AnimationMixer(model);
        mixerHolder.mixer = mixer;
        for (const [name, hints] of Object.entries(CLIP_HINTS)) {
          const clip = pickClip(clips, hints);
          if (clip) mixerHolder.actions[name] = mixer.clipAction(clip);
        }
        if (!mixerHolder.actions.idle && clips[0]) {
          mixerHolder.actions.idle = mixer.clipAction(clips[0]);
        }
        play(poseRef.current);
      },
      undefined,
      () => {
        if (!disposed) setMissing(true);
      }
    );

    const clock = new THREE.Clock();
    const tick = () => {
      frame = window.requestAnimationFrame(tick);
      if (mixerHolder.mixer) {
        if (mixerHolder.current !== poseRef.current) play(poseRef.current);
        mixerHolder.mixer.update(clock.getDelta());
      }
      renderer.render(scene, camera);
    };
    tick();

    return () => {
      disposed = true;
      window.cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  return (
    <div className={`avatar${listening ? " listening" : ""}`} ref={mountRef}>
      {missing && (
        <p className="model-missing">public/models/margit.glb ontbreekt op deze PC.</p>
      )}
    </div>
  );
}
