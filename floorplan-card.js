
class ActiveDrawing extends HTMLElement {

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  updateStates() {
    const svg_doc = this.image.getSVGDocument();
    if(svg_doc && this.myHass)
    {
        var states = this.myHass.states;

        // For each group of the card's config
        this.config.groups.forEach(function(group)
        {
          // If the group has a "states" item
          if("states" in group)
          {
              // Create a dictionary of state-dependent styles
              var style_map = new Map();
              group.states.forEach(function(state_obj)
              {
                style_map.set(state_obj.state, state_obj.class);
              });

              // For each entity set the style according to the state
              group.entities.forEach(function(entity_id)
              {
                const state = states[entity_id];
                const state_str = state ? state.state : 'unavailable';
                var style_class = style_map.get(state_str);
                style_class = style_class ? style_class : 'default';
                var entity = svg_doc.getElementById(entity_id);
                if(entity){
                    entity.setAttribute("class", style_class);
                }else{
                    console.warn("Cannot apply style class because svg is missing element with id " + entity_id);
                }
              });
          }
          // If the group has on_update: 'set_text'
          if("on_update" in group && group.on_update == "set_text")
          {
              // For each entity write the current status into the svg element
              group.entities.forEach(function(entity_id)
              {
                // Get entity and state
                const entity = states[entity_id];
                var state_str = entity.state;
                // If there is a unit of measurement, append it
                var unit = entity["attributes"]["unit_of_measurement"];
                if(unit){
                    state_str = state_str + unit;
                }
                // Get svg element and write text
                var element = svg_doc.getElementById(entity_id);
                if(element){
                    // Is the actual text wrapped into a nested tspan?
                    const tspans = element.getElementsByTagName("tspan");
                    if(tspans.length == 1){
                      element = tspans[0];
                    }
                    element.textContent = state_str;
                }else{
                    console.warn("Cannot set text because svg is missing element with id " + entity_id);
                }
              });
          }
        });
    }
  }

  prepareSVGOnceLoaded() {
    // Add the stylesheet to the svg file
    var svg_doc = this.image.contentDocument;
    var style = svg_doc.createElementNS("http://www.w3.org/2000/svg", "style");
    // Make the browser load our css
    style.textContent = '@import url("' + this.config.stylesheet + '");';
    var svgElem = svg_doc.querySelector('svg');
    svgElem.insertBefore(style, svgElem.firstChild);

    // Set onClick handlers for each entity in a group for actions and more-info dialogue
    this.config.groups.forEach(group => { // For each group of the card's config
      // If the group has an "entities" item
      if("entities" in group)
      {
          // For each of the entities
          group.entities.forEach(entity_id => {
            var domain = entity_id.split('.')[0];
            var svg_element = svg_doc.getElementById(entity_id);

            if(svg_element){ // Check if the entity is in the svg graph
                // Action: Toggle on click/touch
                if("action" in group && group.action.service == "toggle"){
                    // Bind parameters to hass service action function
                    const toggle_func = this.myHass.callService.bind(
                          this.myHass, domain, 'toggle', { 'entity_id': entity_id }
                    );
                    // Click event for mouse
                    svg_element.addEventListener('click', function(event){ toggle_func(); } );
                    // Touch event for touchscreens
                    svg_element.addEventListener('touchend', function(event){ toggle_func(); } );
                // Default: Open more-info box on click/touch
                }else{
                    // Click event for mouse
                    svg_element.addEventListener('click', e => {
                            var new_event = new Event('hass-more-info');
                            new_event.detail = {'entityId': entity_id};
                            document.querySelector('home-assistant').dispatchEvent(new_event);
                        }
                    );
                    // Touch event for touchscreens
                    svg_element.addEventListener('touchend', e => {
                            var new_event = new Event("hass-more-info");
                            new_event.detail = {entityId: entity_id};
                            document.querySelector('home-assistant').dispatchEvent(new_event);
                            e.preventDefault();
                        }
                    );
                }
            }else{
                console.warn("Element with id missing in svg for configured entity " + entity_id)
            }
          });
      }
    });

    // Already update the states if possible
    this.updateStates();
  }

  setConfig(config) {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    if (!config.image) {
      throw new Error('You need to define an svg image');
    }
    if (!config.stylesheet) {
      throw new Error('You need to define a stylesheet');
    }
    this.config = config;

    if(!this.content)
    {
      // Create basic structure of the card
      const root = this.shadowRoot;
      this.card = document.createElement('fp-card');
      this.card.header = 'floorplan-card';
      this.content = document.createElement('div');
      this.content.style.padding = '0 16px 16px';

      // Add svg file to card and insert css style once loaded
      this.image = document.createElement('object');
      this.image.type = 'image/svg+xml';
      this.image.data = this.config.image;
      this.image.style = 'width: 100%';
      this.image.id = "fp-image";
      this.image.async = false;
      this.image.onload = this.prepareSVGOnceLoaded.bind(this);

      // Put all the HTML elements together and also add the title if available
      this.content.appendChild(this.image);
      this.card.appendChild(this.content);
      if(this.config.title){
        const title = document.createElement('h1');
        title.innerHTML = this.config.title;
        root.appendChild(title);
      }
      root.appendChild(this.card);
    }
  }

  set hass(hass) {
    // Store the hass object for use in other functions
    this.myHass = hass;

    // Update states on the svg picture
    this.updateStates();
  }

  getCardSize() {
    return 8;
  }
}
customElements.define('floorplan-card', ActiveDrawing);
window.customCards = window.customCards || [];
window.customCards.push({
    type: "floorplan-card",
    name: "Floorplan Card"
});
