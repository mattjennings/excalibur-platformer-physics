import { RaycastComponent } from '@/components/physics/raycast'

export class Actor extends ex.Actor {
  constructor(args: ex.ActorArgs) {
    super(args)
    this.addComponent(new RaycastComponent())
  }

  public get raycast() {
    return this.get(RaycastComponent)
  }
}
