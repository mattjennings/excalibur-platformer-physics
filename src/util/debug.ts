import { ExcaliburGraphicsContext } from 'excalibur'

export class Debug {
  static draw(owner: ex.Actor, draw: (ctx: ExcaliburGraphicsContext) => void) {
    owner.once('pretransformdraw', ({ ctx }) => {
      draw(ctx)
    })
  }

  static drawRay(owner: ex.Actor, ray: ex.Ray, distance: number) {
    Debug.draw(owner, (ctx) => {
      const start = ray.pos
      const end = ray.pos.add(ray.dir.scale(distance))

      const w = (v: ex.Vector) =>
        owner.scene.engine.screen.screenToWorldCoordinates(v)
      ctx.drawLine(w(start), w(end), ex.Color.Blue, 1)
    })
  }
}
