import { useEffect, useRef, useState } from "react";

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
const LOADER_URL = "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/loaders/GLTFLoader.js";
const MODEL_URLS = ["/models/margit.glb", "/img/margit.glb"];
// talking.glb, motivational.glb, and confusedscratching.glb are the same file.
// It holds every clip. wave.glb and celebrate.glb are a smaller copy of two of them.
const ANIM_URL = "/anims/talking.glb";

const CLIP_FOR_MODE = {
  idle: "Idle_3",
  talking: "Talk_with_Hands_Open",
  talk: "Talk_with_Hands_Open",
  encourage: "Motivational_Cheer",
  cheer: "Motivational_Cheer",
  celebrate: "Victory_Cheer",
  victory: "Victory_Cheer",
  think: "Confused_Scratch",
  confused: "Confused_Scratch",
  wave: "Wave_One_Hand",
  walk: "Walking"
};

function startViewer(THREE, GLTFLoader, host, modeRef, onReady) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 50);
  const sway = new THREE.Group();
  scene.add(sway);

  scene.add(new THREE.AmbientLight(0xfff4e8, 0.85));
  const sun = new THREE.DirectionalLight(0xfff7ee, 1.35);
  sun.position.set(0.6, 1.4, 1.2);
  scene.add(sun);

  let mixer = null;
  let actions = {};
  let current = null;
  let currentName = "";
  let fading = null;
  let intro = true;
  let model = null;
  let height = 1;
  let fitWidth = 1;
  let raf = 0;
  let dead = false;
  const clock = new THREE.Clock();

  function resize() {
    const width = host.clientWidth || host.parentElement?.clientWidth || 320;
    const viewHeight = host.clientHeight || 560;
    if (!width || !viewHeight) return;
    camera.aspect = width / viewHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(width, viewHeight, false);
  }

  function fitCamera() {
    const aspect = Math.max(camera.aspect || 1, 0.2);
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect);
    const distH = (height * 0.62) / Math.tan(vFov / 2);
    const distW = (fitWidth * 0.62) / Math.tan(hFov / 2);
    const dist = Math.max(distH, distW);
    camera.position.set(0, height * 0.48, dist);
    camera.lookAt(0, height * 0.46, 0);
    camera.updateProjectionMatrix();
  }

  function frameModel(root) {
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    root.position.x -= center.x;
    root.position.z -= center.z;
    root.position.y -= box.min.y;
    height = Math.max(size.y, 0.1);
    fitWidth = Math.max(size.x, 0.1);
    fitCamera();
  }

  function inPlace(clip) {
    const tracks = clip.tracks.filter((track) => !/Hips\.position$/.test(track.name));
    if (tracks.length === clip.tracks.length) return clip;
    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }

  function takeClip(pool, clipName) {
    const source = THREE.AnimationClip.findByName(pool, clipName);
    return source ? inPlace(source) : null;
  }

  function play(name) {
    const next = actions[name];
    if (!next || next === current) return;
    const once = name === "wave";
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    if (current) {
      current.fadeOut(0.3);
      fading = current;
      next.fadeIn(0.3);
    }
    next.play();
    current = next;
    currentName = name;
  }

  function desiredName() {
    const mode = modeRef.current || "idle";
    if (mode !== "idle") intro = false;
    if (intro && actions.wave) return "wave";
    if (actions[mode]) return mode;
    if (mode !== "idle" && actions.walk) return "walk";
    if (actions.idle) return "idle";
    return "";
  }

  let lastW = 0;
  let lastH = 0;

  function tick() {
    if (dead) return;
    raf = requestAnimationFrame(tick);
    const width = host.clientWidth || host.parentElement?.clientWidth || 0;
    const viewHeight = host.clientHeight || 0;
    if (width && viewHeight && (width !== lastW || viewHeight !== lastH)) {
      lastW = width;
      lastH = viewHeight;
      camera.aspect = width / viewHeight;
      renderer.setSize(width, viewHeight, false);
      fitCamera();
    }

    const dt = Math.min(clock.getDelta(), 0.05);
    const elapsed = clock.elapsedTime;
    const mode = modeRef.current || "idle";
    const name = desiredName();
    if (name) play(name);
    if (mixer && name) mixer.update(dt);
    if (fading && fading !== current && fading.getEffectiveWeight() < 0.04) {
      fading.stop();
      fading = null;
    }

    if (!name) {
      sway.rotation.y = Math.sin(elapsed * 0.85) * (mode === "idle" ? 0.1 : 0.2);
      sway.rotation.z = Math.sin(elapsed * 0.55) * (mode === "idle" ? 0.015 : 0.04);
      sway.position.y = Math.sin(elapsed * 1.15) * height * (mode === "idle" ? 0.008 : 0.02);
    } else {
      sway.rotation.y *= 0.9;
      sway.rotation.z *= 0.9;
      sway.position.y *= 0.9;
    }

    renderer.render(scene, camera);
  }

  let modelGltf = null;
  let animGltf = null;
  let animSettled = false;
  let started = false;

  function boot() {
    if (dead || started || !modelGltf || !animSettled) return;
    started = true;
    model = modelGltf.scene;
    sway.add(model);
    frameModel(model);

    const pool = [
      ...(animGltf ? animGltf.animations : []),
      ...modelGltf.animations
    ];
    mixer = new THREE.AnimationMixer(model);
    mixer.addEventListener("finished", (event) => {
      if (event.action === actions.wave) intro = false;
    });
    actions = {};
    for (const mode of Object.keys(CLIP_FOR_MODE)) {
      const clip = takeClip(pool, CLIP_FOR_MODE[mode]);
      if (!clip) continue;
      actions[mode] = mixer.clipAction(clip);
    }
    if (!actions.wave) intro = false;

    resize();
    onReady();
    raf = requestAnimationFrame(tick);
  }

  const loader = new GLTFLoader();
  const animLoader = new GLTFLoader();
  function loadFirst(urls) {
    const [url, ...rest] = urls;
    if (!url) {
      if (!dead) onReady(new Error("model"));
      return;
    }
    loader.load(
      url,
      (gltf) => {
        if (dead) return;
        modelGltf = gltf;
        boot();
      },
      undefined,
      () => {
        if (dead) return;
        if (rest.length) loadFirst(rest);
        else onReady(new Error("model"));
      }
    );
  }
  loadFirst(MODEL_URLS);
  animLoader.load(
    ANIM_URL,
    (gltf) => {
      if (dead) return;
      animGltf = gltf;
      animSettled = true;
      boot();
    },
    undefined,
    () => {
      if (dead) return;
      animSettled = true;
      boot();
    }
  );

  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  return () => {
    dead = true;
    cancelAnimationFrame(raf);
    observer.disconnect();
    renderer.dispose();
    if (renderer.domElement.parentNode) {
      renderer.domElement.parentNode.removeChild(renderer.domElement);
    }
  };
}

export default function MargitFigure({ mode, src }) {
  const hostRef = useRef(null);
  const modeRef = useRef(mode);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  modeRef.current = mode;

  useEffect(() => {
    let dead = false;
    let stop = () => {};
    const host = hostRef.current;

    (async () => {
      try {
        const THREE = await import(/* @vite-ignore */ THREE_URL);
        const loaderModule = await import(/* @vite-ignore */ LOADER_URL);
        if (dead || !host) return;
        stop = startViewer(THREE, loaderModule.GLTFLoader, host, modeRef, (error) => {
          if (dead) return;
          if (error) setFailed(true);
          else setReady(true);
        });
        if (dead) stop();
      } catch {
        if (!dead) setFailed(true);
      }
    })();

    return () => {
      dead = true;
      stop();
    };
  }, []);

  const showPicture = failed || !ready;

  return (
    <>
      {showPicture ? <img src={src} alt="Margit" /> : null}
      <div ref={hostRef} className="figure-view" />
    </>
  );
}
