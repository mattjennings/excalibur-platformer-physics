import { PhysicsSystem } from '@/systems/physics'

export class Scene extends ex.Scene {
  constructor() {
    super()
    this.world.clearSystems()
    this.world.systemManager.addSystem(new ex.GraphicsSystem())
    this.world.systemManager.addSystem(new ex.DebugSystem())
    // this.world.systemManager.addSystem(new ex.MotionSystem())
    this.world.systemManager.addSystem(new PhysicsSystem())
  }
}
