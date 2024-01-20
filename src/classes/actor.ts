import { PhysicsComponent } from '@/components/physics/physics'

export class Actor extends ex.Actor {
  constructor(args: ex.ActorArgs) {
    super(args)
    this.addComponent(new PhysicsComponent())
  }

  public get physics(): PhysicsComponent {
    return this.get(PhysicsComponent)!
  }
}
