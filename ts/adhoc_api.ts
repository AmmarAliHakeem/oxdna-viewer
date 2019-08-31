/// <reference path="./main.ts" />
// Usefull bits of code simplifying quering the structure

module api{
    export function toggle_strand(strand: Strand): Strand{
        let nucleotides = strand[monomers]; 
        nucleotides.map( 
            (n:Nucleotide) => n.visible = !n.visible);
        render();
        return strand;
    }

    // TODO: integrate with the selection mechanism 
    export function mark_stand(strand: Strand): Strand{
        let nucleotides = strand[monomers];
        nucleotides.map((n: Nucleotide) => n.toggle());
        render();
        return strand;
    };

    export function get_sequence(strand : Strand) : string {
        let seq: string[];
        let nucleotides = strand[monomers]; 
        nucleotides.reverse().map( 
            (n: BasicElement) => seq.push(<string> n.type));
        return seq.join("");
    };

    // get a dictionary with every strand length : [strand] listed   
    export function count_stand_length({system = systems[0]} = {}) {
        let strand_length : { [index: number]: [Strand] } = {};
        system[strands].map((strand: Strand) => {
            let l = strand[monomers].length;
            if( l in strand_length) 
                strand_length[l].push(strand);
            else
                strand_length[l] = [strand];
        });
        return strand_length;  
    };

    export function highlite5ps({system = systems[0]} = {}){
        system[strands].map((strand) => {
            strand[monomers][strand[monomers].length - 1].toggle();
        });
        render();
    }

    export function toggle_all({system = systems[0]} = {}){
        system[strands].map((strand)=>{
            let nucleotides = strand[monomers]; 
            nucleotides.map((n:BasicElement) => n.visible = !n.visible);
        });
        render();
    }
    export function toggle_base_colors() {
        elements.map(
            (n: BasicElement) => {
                let obj = n[objects][n.NUCLEOSIDE] as any 
                if (obj.material == grey_material){
                    obj.material = n.elem_to_material(n.type);
                }
                else {
                    obj.material = grey_material;
                }
            }
        )
        render();
    }
    
    export function trace_53(element: BasicElement): BasicElement[]{
        let elements : BasicElement[] = [];
        let c : BasicElement = element; 
        while(c){
            elements.push(c);
            c = c.neighbor3;
        }
        return elements.reverse();
    }

    export function nick(element: BasicElement){
        // we break connection to the 3' neighbor 
        let neighbor =  element.neighbor3;
        element.neighbor3 = null;
        neighbor.neighbor5 = null;
        element.remove(
            element[objects][element.SP_CON]
        );

        let strand = element.parent;
        // nucleotides which are after the nick
        let new_nucleotides : BasicElement[] = trace_53(neighbor);
        strand.exclude_Elements(new_nucleotides);
        
        //create fill and deploy new strand 
        let new_strand = strand.parent.create_Strand(strand.parent[strands].length + 1);
        new_nucleotides.forEach(
            (n) => {
                new_strand.add_basicElement(n);
            }
        );
        //voodoo
        strand.parent.add_strand(new_strand);
        render(); 
    }

    export function ligate(element1 :BasicElement, element2: BasicElement){
        console.log("Experimental, does not update strand indices yet and will break with Shuchi's update!");
        if(element1.parent.parent !== element2.parent.parent){
            return;
        }
        // assume for now that element1 is 5' and element2 is 3' 
        // get the reference to the strands 
        // strand2 will be merged into strand1 
        let strand1 = element1.parent;
        let strand2 = element2.parent;
        // lets orphan strand2 element
        let bases2 = [...strand2[monomers]]; // clone the refferences to the elements
        strand2.exclude_Elements(strand2[monomers]);
        
        //check that it is not the same strand
        if (strand1 !== strand2){
            //remove strand2 object 
            strand2.parent.remove(strand2);
            /*strand2.parent[strands] = strand2.parent[strands].filter((ele)=>{
                return ele != strand2;
            });*/
        }

        // and add them back into strand1 
        //create fill and deploy new strand 
        bases2.forEach(
            (n) => {
                strand1.add_basicElement(n);
            }
        );
        //interconnect the 2 element objects 
        element1.neighbor5 = element2;
        element2.neighbor3 = element1;
        //TODO: CLEAN UP!!!
        //////last, add the sugar-phosphate bond since its not done for the first nucleotide in each strand
        let p2 = element2[objects][element2.BACKBONE].position;
        let x_bb = p2.x,
            y_bb = p2.y,
            z_bb = p2.z;

        let p1 = element1[objects][element1.BACKBONE].position;
        let x_bb_last = p1.x,
            y_bb_last = p1.y,
            z_bb_last = p1.z;


        let x_sp = (x_bb + x_bb_last) / 2, //sugar phospate position in center of both current and last sugar phosphates
            y_sp = (y_bb + y_bb_last) / 2,
            z_sp = (z_bb + z_bb_last) / 2;

        let sp_len = Math.sqrt(Math.pow(x_bb - x_bb_last, 2) + Math.pow(y_bb - y_bb_last, 2) + Math.pow(z_bb - z_bb_last, 2));
        // easy periodic boundary condition fix  
        // if the bonds are to long just don't add them 
        if (sp_len <= 500) {
            let rotation_sp = new THREE.Matrix4().makeRotationFromQuaternion(
                new THREE.Quaternion().setFromUnitVectors(
                    new THREE.Vector3(0, 1, 0), new THREE.Vector3(x_sp - x_bb, y_sp - y_bb, z_sp - z_bb).normalize()
                )
            );
            let sp = new THREE.Mesh(connector_geometry, element1.strand_to_material(strand2.strand_id));
            sp.applyMatrix(new THREE.Matrix4().makeScale(1.0, sp_len, 1.0)); //set length according to distance between current and last sugar phosphate
            sp.applyMatrix(rotation_sp); //set rotation
            sp.position.set(x_sp, y_sp, z_sp);
            element1.add(sp); //add to visual_object
        }
        // Strand id update
        let str_id = 1; 
        let sys = element1.parent.parent;
        sys[strands].forEach((strand) =>strand.strand_id = str_id++);
        render();
    }
    
    export function strand_add_to_system(strand:Strand, system: System){
        // kill strand in its previous system
        strand.parent[strands] = strand.parent[strands].filter((ele)=>{
            return ele != strand;
        }); 

        // add strand to the desired system
        let str_id = system[strands].length + 1;
        system[strands].push(strand);
        strand.strand_id = str_id;
        strand.parent = system;
    }

    //there's probably a less blunt way to do this...
    export function remove_colorbar() {
        for (let i = 7+sys_count; i < 20; i++) {
            scene.remove(scene[objects][7+sys_count]);
        }
        render();
    }

    export function show_colorbar() {
        scene.add(lut.legend.mesh);
        let labels =  lut.setLegendLabels({'title':lut.legend.labels.title, 'ticks':lut.legend.labels.ticks}); //don't ask, lut stores the values but doesn't actually save the sprites anywhere so you have to make them again...
        scene.add(labels["title"]);
        for (let i = 0; i < Object.keys(labels['ticks']).length; i++) {
            scene.add(labels['ticks'][i]);
            scene.add(labels['lines'][i]);
        }

        render();
    }
    
}