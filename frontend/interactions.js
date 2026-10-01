import {BlocklyCore as Blockly} from './blocks.js';

// Blockly 13.3: extend its standard strategy so keyboard moves, undo, healing
// stacks and replacement previews remain native. The two candidate-search hooks
// are version-sensitive and covered by pointer-drag browser checks.
class CursorDragStrategy extends Blockly.dragging.BlockDragStrategy {
  getTargetBlock() {
    const target=super.getTargetBlock();
    if(target!==this.block)target.setDragStrategy(new CursorDragStrategy(target));
    return target;
  }
  drag(location,event) {
    this.pointer=event instanceof PointerEvent
      ? Blockly.utils.svgMath.screenToWsCoordinates(this.workspace,new Blockly.utils.Coordinate(event.clientX,event.clientY)) : null;
    super.drag(location,event);
  }
  getClosestCandidate(block,delta) {
    if(!this.pointer||this.moveMode===1)return super.getClosestCandidate(block,delta);
    let radius=48,candidate=null;
    const connections=block.outputConnection?[block.outputConnection]:this.getLocalConnections(block);
    for(const local of connections){
      const offset=new Blockly.utils.Coordinate(this.pointer.x-local.x,this.pointer.y-local.y);
      const result=local.closest(radius,offset);
      if(result.connection){candidate={local,neighbour:result.connection,distance:result.radius};radius=result.radius;}
    }
    return candidate;
  }
  currCandidateIsBetter(previous,delta,next) {
    if(!this.pointer||this.moveMode===1)return super.currCandidateIsBetter(previous,delta,next);
    const distance=Math.hypot(this.pointer.x-previous.neighbour.x,this.pointer.y-previous.neighbour.y);
    return distance<48 && next.distance>distance-8;
  }
}

export class CursorDragger extends Blockly.dragging.Dragger {
  onDragStart(event) {
    if(this.draggable instanceof Blockly.BlockSvg)this.draggable.setDragStrategy(new CursorDragStrategy(this.draggable));
    return super.onDragStart(event);
  }
}

export function configureDeletion(workspace) {
  const manager=workspace.getComponentManager(),toolbox=workspace.getToolbox();
  // The toolbox's deletion area extends far beyond the visible categories.
  // Only an explicit drop onto the visible trash can should delete blocks.
  manager.removeCapability(toolbox.id,Blockly.ComponentManager.Capability.DELETE_AREA);
  toolbox.shouldPreventMove=()=>true;
  workspace.trashcan.getClientRect=()=>Blockly.utils.Rect.from(workspace.getParentSvg().querySelector('.blocklyTrash').getBoundingClientRect());
}
