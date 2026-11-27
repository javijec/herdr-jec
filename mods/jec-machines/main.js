import { View, div } from "gpui-kit";
import { v_flex,h_flex } from "gpui-base";
import { machines,spaces,agents,theme,run,props,closeOverlay } from "herdr";
import { machineRows } from "./model.js";
const states=["working","blocked","done","idle","unknown"];
function counts(t,c){
 return h_flex().gap(8).items_center().children(states.filter(k=>c[k]>0).map(k=>
   h_flex().gap(4).items_center().child(div().size(7).rounded(4).bg(t[k]||t.dim))
   .child(div().text_size(11).text_color(t.muted).child(k+" "+c[k]))));
}
export default class Machines extends View{
 render(){
   const t=theme(),rows=machineRows(machines(),spaces(),agents());
   return v_flex().size_full().min_h(0).bg(t.background).text_color(t.foreground).p(14).gap(10)
     .child(h_flex().items_center().gap(8)
       .child(div().font_semibold().text_size(17).child("Machines"))
       .child(div().flex_1())
       .child(div().text_size(11).text_color(t.muted).child(rows.length+" equipos")))
     .child(v_flex().flex_1().min_h(0).overflow_y_scrollbar().gap(8)
       .when(!rows.length,el=>el.child(div().text_color(t.muted).child("No hay equipos disponibles.")))
       .children(rows.map((m,i)=>v_flex().id("machine-"+i).p(10).gap(6).rounded(8).border_1().border_color(t.border)
         .child(h_flex().items_center().gap(8)
           .child(div().font_semibold().child(m.name??"Equipo local"))
           .child(div().flex_1())
           .child(div().text_size(11).text_color(m.layout==="ready"?t.done:m.layout==="unavailable"?t.blocked:t.muted)
             .child(m.layout==="ready"?"Disponible":m.layout==="unavailable"?"No disponible":m.layout==="loading"?"Cargando":"Sin estado")))
         .child(counts(t,m.counts))
         .when(!m.spaces.length,el=>el.child(div().text_size(11).text_color(t.dim).child("Sin espacios")))
         .children(m.spaces.map(s=>h_flex().id("space-"+s.id).p(7).rounded(5).gap(8).items_center()
           .bg(s.active?t.selected:t.raised).hover(el=>el.bg(t.hover)).cursor_pointer()
           .on_click(()=>{run("space.select",{id:s.id});if(props()?.overlay)closeOverlay(props().overlay);})
           .child(div().flex_1().truncate().text_size(12).child(s.name))
           .child(div().text_size(11).text_color(t.dim).child(s.tabs+" pestañas"))
           .child(counts(t,s.counts)))))));
 }
}
