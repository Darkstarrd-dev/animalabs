const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const api = p => fetch(p).then(r => { if(!r.ok) throw new Error(r.status+' '+r.statusText); return r.json(); });

let state = { date:'', job:'', item:'', scene:'', variant:'', filter:'all', tagFilter:'', sortBy:'id', dates:[], jobsByDate:{}, curJob:null, thumbSize:260, preset:'turbo', unet:'', lora1:'off', lora2:'off', lora3:'off', wt1:0.8, wt2:1, wt3:1, hdrSteps:'', hdrCfg:'', hdrSampler:'', hdrScheduler:'', hdrBatch:'' };
let selectedIds = new Set();
let monthCollapsed = new Set();
let dayCollapsed = new Set();
let sceneCollapsed = new Set();
let pollTimer = null;
let treeCollapsed = localStorage.getItem('anima.treeCollapsed')==='1';
let hdrMeta={unets:[],loras:[],samplers:[],schedulers:[]};
let hdrUserEdited=false;
