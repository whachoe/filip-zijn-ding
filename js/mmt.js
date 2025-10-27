(function(){
    const categories = [
        'Category 1: Governance, Regulation, and Market Management',
        'Category 2: Infrastructure and Facilities',
        // 'Category 3: Biosecurity and Hygiene Practices',
        // 'Category 4: Zoonotic Risk Factors',
        // 'Category 5: Surveillance and Reporting',
        // 'Category 6: Risk Communication and Awareness',
        // 'Category 7: Market Connectivity and Trade Dynamics',
        // 'Category 8: Emergency Preparedness and Risk Mitigation',
        // 'Category 9: Stakeholder Engagement'
    ];

    let indicators = [];

    indicators[0] = [
        {
            name: 'Oversight by veterinary / public‑health authorities',
            scores: [
                'No routine inspections; no designated authority',
                'Occasional inspection; unclear authority roles',
                'Regular inspections; authority roles defined',
                'Inspections at defined frequency, enforcement active, authority roles integrated with One Health partners'           
            ]
        },
        {
            name: 'Licensing/registration of market and vendors',
            scores: [
                'Market and vendors operate without registration or licence',
                'Partial registration / informal records',
                'Most vendors registered; market licenced but oversight weak',
                'All vendors registered/licenced, verification system in place, records up‑to‑date'

            ]
        },
        {
            name: 'Presence of market management committee / designated authority',
            scores: [
                'No management committee or designated body',
                'Management body exists but meets rarely / weak capacity',
                'Committee meets regularly, some authority, some coordination with authorities',
                'Committee active, empowered, coordinates with veterinary/public health, holds meetings, agenda, follows up actions'
            ]
        },
        {
            name: 'Enforcement of hygiene, animal welfare, disease‑control regulations',
            scores: [
                'Regulations exist in paper but never enforced',
                'Some regulatory actions but inconsistent or weak',
                'Regulations enforced routinely but occasional non‑compliance remains',
                'Regulations enforced, sanctions applied for non‑compliance, compliance monitoring in place'
            ]
        },
        {
            name: 'Implementation of SOPs for cleaning, disinfection, slaughter & animal handling',
            scores: [
                'No SOPs or not known to staff',
                'SOPs exist but not always followed/monitored',
                'SOPs exist, staff aware, mostly followed, monitoring occasional',
                'SOPs exist, training done, monitoring and corrective actions routine, audit trail present'
            ]
        },
        {
            name: 'Existence of market‑level rules/by‑laws aligned with national policies',
            scores: [
                'No market‑level rules/by‑laws',
                'Some rules exist but not aligned with national policy or not enforced',
                'Rules aligned with national policy, enforced with some gaps',
                'Fully aligned with national policy, regularly reviewed, enforced, documented compliance'
            ]
        }
    ];

    indicators[1] = [
        {
            name: 'Physical layout: species/zone segregation, slaughter/retail zones',
            scores: [
                'Mixed species and uses, no zoning, slaughter in retail area',
                'Some zonation but overlaps; slaughter/retail not clearly separated',
                'Zoning defined, mostly respected, slaughter largely separated from retail',
                'Clear physical zoning, species segregation, slaughter in dedicated area, well‑marked flows'
            ]
        },
        {
            name: 'Adequacy of drainage, solid waste disposal, WASH (water/handwashing) systems',
            scores: [
                'Poor drainage, waste piles, limited hand‑washing facilities',
                'Basic drainage, limited waste disposal, some hand‑washing stations',
                'Good drainage, waste disposal functioning, hand‑washing available but may have interruptions',
                'High standard drainage, waste disposal and removal, multiple hand‑washing/disinfection stations, WASH system reliable'
            ]
        },
        {
            name: 'Access to hand‑washing and disinfection stations',
            scores: [
                'No or minimal stations; not accessible to vendors/visitors',
                'Some stations but limited; no routine maintenance',
                'Stations present, accessible, used regularly though some gaps',
                'Stations well placed, good coverage, maintained, used routinely by vendors/visitors'
            ]
        },
        {
            name: 'Facilities for carcass disposal & wastewater management',
            scores: [
                'Carcasses/waste left on site or disposed openly; wastewater uncontrolled',
                'Basic waste disposal but some open access; wastewater partially managed',
                'Carcass disposal protocols exist, wastewater managed but occasional overflow',
                'Carcass disposal fully managed off‑site or via approved system, wastewater treated or contained, no visible waste/water contamination'
            ]
        },
        {
            name: 'Availability of cold storage / chilling units for products',
            scores: [
                'No cold storage / products often unrefrigerated',
                'Some cold storage but inadequate capacity or maintenance',
                'Cold storage available and functional but not for all products',
                'Cold storage/chilling units available, well‑maintained, sufficient capacity, used routinely'
            ]
        },
        {
            name: 'Holding pens and unloading/loading infrastructure',
            scores: [
                'Holding pens inadequate, mixed species, unloading/loading chaotic',
                'Some pens/unloading area but overcrowded or poorly managed',
                'Holding and unloading systems functioning though may be stressed at peak times',
                'Dedicated holding pens, species segregated, unloading/loading flow well managed, minimize animal stress and mixing'
            ]
        }
    ];  


    // Generate the Assessment Form
    document.getElementById('new_assessment_wrapper').innerHTML = generate_assessment_form(categories, indicators);

    // Add the Next and Previous buttons to handle navigation
    u(document.querySelectorAll('.next-btn')).each(btn => btn.addEventListener('click', (e) => {
        let cat = e.currentTarget.getAttribute('category');
        console.log(cat);
        u(document.getElementById('category-${cat}')).addClass('hidden');
        u(document.getElementById('category-${cat+1}')).removeClass('hidden');
    }));
    u(document.querySelectorAll('.prev-btn')).each(btn => btn.addEventListener('click', (e) => {
        let cat = e.currentTarget.getAttribute('category');
        
        u(document.getElementById('category-${cat}')).addClass('hidden');
        u(document.getElementById('category-${cat-1}')).removeClass('hidden');
    }));


    function generate_assessment_form(categories, indicators) {

        /*
        `<div id="my-slider" class="slider" aria-roledescription="carousel">
        `  <div class="slides" role="list">
                <div class="slide" role="listitem">Page 1 — Intro</div>
                <div class="slide" role="listitem">Page 2 — Details</div>
                <div class="slide" role="listitem">Page 3 — More</div>
            </div>

            <button class="nav prev" aria-abel="Previous page">&larr;</button>
            <button class="nav next" aria-label="Next page">&rarr;</button>

             <div class="dots" aria-hidden="false"></div>
        </div>
`*/
        let html = `
        <form id="assessment-form">
          <div id="my-slider" class="slider" aria-roledescription="carousel">
            <div class="slides" role="list">`;

        categories.forEach((category, catIdx) => {
            console.log(category, catIdx);
            
            html += `
            <div class="slide" role="listitem">
            <fieldset id="category-${catIdx}">
            <legend>${category}</legend>`;

            indicators[catIdx].forEach((indicator, indIdx) => {
                html += `<span class="indicator-label">${indicator.name}</span>`;
                indicator.scores.forEach((score, scoreIdx) => {
                    html += `<input type="radio" class="indicator-value" name="indicator-${catIdx}-${indIdx}" value="${scoreIdx + 1}">${score}</input><br/>`;
                });
            });

            html += `      
            </fieldset></div>`;
            
        });

        html += ` 
          </div>               
            <button class="nav prev" aria-abel="Previous page">&larr;</button>
            <button class="nav next" aria-label="Next page">&rarr;</button>

            <div class="dots" aria-hidden="false"></div>
          </form></div>`;

        return html;
    }
})();