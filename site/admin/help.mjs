const meanings={
 blur:'Softens the photo behind glass surfaces such as the menu. Try 8 px for a light frost or 24 px for a stronger frost. A pixel (px) is a small unit of screen space.',
 tint:'Darkens the glass behind menu text. Raise the percentage if the text is hard to read over a bright photo.',
 radius:'Rounds the corners of glass controls. Use 0 px for square corners. A larger number makes the corners rounder.',
 accent:'Pick the highlight colour used on glass borders and controls.',
 heading:'Choose the typeface used for headings throughout your website.',
 motion:'Choose how much the page moves as visitors scroll. Still turns automatic effects off.',
 speed:'Choose how quickly menus and page effects finish moving.',
 slides:'Automatic advances the project slideshow. Manual lets visitors change slides themselves.',
 interval:'The number of seconds each automatic slide stays on screen. Increase it to give visitors more reading time.',
 header:'Choose whether the top menu always stays on screen or hides when visitors scroll down.',
 letterCase:'Use all capital letters for headings or show them exactly as you typed them.',
 weight:'Sets the thickness of heading letters. Bold is heavier than Medium.',
 bodySize:'Changes the size of normal website text. Start at 16 px. A pixel (px) is a small unit of screen space.',
 heroAlign:'Moves the opening banner text to the left, centre or right.',
 shade:'Adds darkness over the opening banner. Increase it to help light text stand out.',
 background:'Choose the base colour behind your website content.',
 foreground:'Choose the usual text colour. Pick one that is easy to read against your background.',
 brand:'The company name shown on the website and in page titles.',
 phone:'Use digits only, including the country code. For India, start with 91.',
 label:'The words visitors see on this menu link or action. Keep them short.',
 url:'Where the link takes a visitor. Paste a full HTTPS address or choose an existing page below.',
 slug:'Choose a project from your website. The card uses its details and opens its project page.',
 title:'The main heading visitors see for this section. Leave it empty if the design already contains its own heading.',
 text:'Supporting copy below the heading. One or two short sentences usually fit well.',
 mode:'Choose an image or a video for the opening banner.',
 height:'The share of the desktop screen occupied by the banner. 100% fills the screen height.',
 mobileHeight:'The share of a phone screen occupied by the banner. Lower it to show more of the next section.',
 fit:'Fill crops the edges to cover the banner. Show the whole image keeps every edge visible.',
 message:'The message that appears in WhatsApp when a visitor chooses this action.',
 button:'The words visitors click, such as “Book a visit”. Choose the destination below.',
 code:'Paste the whole section from ChatGPT here. Use the prompt in this panel to get code the editor understands.',
 frameTheme:'Match website uses your theme colours and heading styles. Keep code styling uses the design supplied with the section.',
 frameMode:'Auto-fit grows with the content. Fixed height reserves the number of pixels you enter.',
 phoneCodeHeight:'The height reserved on phones in fixed-height mode. Leave blank to use the desktop height.',
 codeHeight:'The space reserved for a fixed-height section. A pixel (px) is a small unit of screen space.',
 name:'The property name shown on its page and project cards.',
 type:'The kind of property, for example a villa, apartment or plot.',
 location:'The neighbourhood or area shown on project cards and the project page.',
 price:'The price wording visitors see, for example “From ₹65 lakh”.',
 size:'Enter the floor or plot size, including the unit, for example “1,800 sq ft”.',
 status:'Describe the project stage, for example “Under construction”.',
 about:'Describe this project for buyers. This text appears on the project page.',
 maps:'Paste the share link from Google Maps for the property location.',
 layout:'Choose the standard property layout or use your own custom page with enquiry buttons.'
};
export function fieldHelp(label,key){
 if(/padding/i.test(label))return 'Padding is empty space inside the section. This changes '+label.split(' padding')[0].toLowerCase()+' spacing. Try 16 px, enter 0 for no gap, or leave blank for the theme default. A pixel (px) is a small unit of screen space.';
 return meanings[key]||'Edit the '+label.toLowerCase()+' shown in this section. Check the result in the preview.';
}
const actions={
 '↑':'Move this item one place earlier.','↓':'Move this item one place later.',
 'Remove':'Remove this item from your draft. You will be asked to confirm.',
 'Duplicate section':'Make an editable copy immediately after this section.',
 'Add section':'Insert the selected kind of section at the chosen position.',
 'Add project card':'Show another property here. Choose its project and optionally replace its image.',
 'Add project':'Create a property and its own website page.',
 'Copy ChatGPT prompt':'Copy the section instructions. Paste them into ChatGPT and describe the design you want.',
 'Auto-fit section':'Let this section grow and shrink to fit its content on desktop and phone.',
 'Use starter section':'Fill the code box with a working example you can edit.',
 'Publish':'Send this draft to your website. You will be asked to confirm.',
 'Preview':'Open a larger preview of your draft. You can visit other project pages here.',
 'Overview':'Open draft tools, download a backup or sign out.',
 'Homepage':'Choose a homepage section and edit it alongside the preview.',
 'Projects':'Edit property details, photos, plans and enquiry links.',
 'Appearance':'Adjust website colours, headings, spacing effects and motion.',
 'Brand & menu':'Change the company identity, contact number and navigation links.',
 'Sign out':'End your editor session on this device.',
 'Download content JSON':'Download a backup of your draft text and file paths.',
 'Discard draft and reload latest':'Replace this device’s draft with the last published content after confirmation.',
 'Add menu link':'Add a label and destination to the website menu.',
 'Add WhatsApp action':'Add a button with its own prefilled WhatsApp message.',
 'Remove this project':'Remove the property from the draft and its page on publication.',
 'Desktop':'See how your draft looks at the available desktop width.',
 'Phone':'Preview the narrow layout visitors see on a phone.',
 'Select section':'Turn on selection, then click a section in the preview to open its settings.',
 'Full width':'Show the preview at the full available width.','Phone width':'Narrow the preview to a phone width.',
 'Close':'Return to editing your draft.'
};
export function actionHelp(name){return actions[name];}
let count=0;
export function attachHelp(container,control,title,message){
 const row=document.createElement('div');row.className='setting-wrap';
 container.before(row);row.append(container);
 const description=document.createElement('span');description.className='visually-hidden';description.id='help-'+(++count);description.textContent=message;
 const trigger=document.createElement('button');trigger.type='button';trigger.className='help-trigger';trigger.textContent='?';trigger.setAttribute('aria-expanded','false');trigger.setAttribute('aria-label','Help with '+title);trigger.setAttribute('aria-describedby',description.id);
 row.dataset.tip=message;row.append(trigger,description);control.setAttribute('aria-describedby',description.id);
}
export function enableHelp(){
 const tip=document.createElement('div');tip.id='setting-tip';tip.hidden=true;tip.setAttribute('aria-hidden','true');document.body.append(tip);
 let active=null;
 function hide(){active?.setAttribute('aria-expanded','false');active=null;tip.hidden=true;}
 document.addEventListener('click',event=>{
  const trigger=event.target.closest('.help-trigger');
  const wasOpen=trigger===active;hide();
  if(!trigger||wasOpen)return;
  active=trigger;trigger.setAttribute('aria-expanded','true');
  const host=trigger.closest('dialog[open]')||document.body;if(tip.parentElement!==host)host.append(tip);
  tip.textContent=trigger.closest('[data-tip]').dataset.tip;tip.hidden=false;
  const rect=trigger.getBoundingClientRect(),box=tip.getBoundingClientRect();
  tip.style.left=Math.max(8,Math.min(rect.left,innerWidth-box.width-8))+'px';
  tip.style.top=(rect.bottom+box.height+8<innerHeight?rect.bottom+5:Math.max(6,rect.top-box.height-5))+'px';
 });
 document.addEventListener('keydown',e=>{if(e.key==='Escape')hide();});
 window.addEventListener('resize',hide);document.addEventListener('scroll',hide,true);
}
