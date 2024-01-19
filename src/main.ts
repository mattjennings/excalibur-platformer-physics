import './style.css'
import { resources } from 'vite-plugin-excalibur-resources/runtime'
import hot from 'vite-plugin-excalibur-hmr/hot'

const INITIAL_SCENE = 'level1'

const game = new ex.Engine({
  width: 300,
  height: 300,
  displayMode: ex.DisplayMode.FitScreen,
})

if (import.meta.env.DEV) {
  hot(game)
}

// load all scenes from ./scenes directory
const scenes = import.meta.glob('./scenes/**/*.ts', { eager: true }) as Record<
  string,
  { default: typeof ex.Scene }
>

for (const [key, scene] of Object.entries(scenes)) {
  const name = key.split('/scenes/')[1].split('.ts')[0]
  game.addScene(name, new scene.default())
}

class DevLoader extends ex.Loader {
  showPlayButton() {
    return Promise.resolve()
  }

  draw() {}
}

// load resources
const loader = new DevLoader(resources)

game.start(loader).then(() => {
  game.goToScene(INITIAL_SCENE)
})
