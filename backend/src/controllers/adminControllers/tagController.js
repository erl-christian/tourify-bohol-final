import Tag from "../../models/tagModels/Tag.js";
import EstablishmentTag from "../../models/tagModels/EstablishmentTag.js";
import BusinessEstablishment from "../../models/businessEstablishmentModels/BusinessEstablishment.js";

// TAG CRUD
export const createTag = async (req,res,next)=>{
  try{
    const { tag_name } = req.body;
    if(!tag_name){ res.status(400); throw new Error("tag_name is required"); }
    const tag = await Tag.create({ tag_name: tag_name.trim() });
    res.status(201).json({ message:"Tag created", tag });
  }catch(e){
    if(e?.code===11000) return res.status(409).json({ message:"Tag already exists" });
    next(e);
  }
};

export const listTags = async (_req,res,next)=>{
  try{
    const tags = await Tag.find().sort({ tag_name:1 });
    res.json({ tags });
  }catch(e){ next(e); }
};

// ASSIGN / REMOVE tag to establishment
export const addTagToEstablishment = async (req,res,next)=>{
  try{
    const { estId } = req.params;
    const { tag_id } = req.body;
    if(!tag_id){ res.status(400); throw new Error("tag_id is required"); }

    const [est, tag] = await Promise.all([
      BusinessEstablishment.findOne({ businessEstablishment_id: estId }),
      Tag.findOne({ tag_id })
    ]);
    if(!est) { res.status(404); throw new Error("Establishment not found"); }
    if(!tag) { res.status(404); throw new Error("Tag not found"); }

    const et = await EstablishmentTag.create({
      business_establishment_id: estId, tag_id
    });
    res.status(201).json({ message:"Tag added", item: et });
  }catch(e){
    if(e?.code===11000) return res.status(200).json({ message:"Tag already assigned" });
    next(e);
  }
};

export const removeTagFromEstablishment = async (req,res,next)=>{
  try{
    const { estId, tagId } = req.params;
    const del = await EstablishmentTag.findOneAndDelete({
      business_establishment_id: estId, tag_id: tagId
    });
    if(!del) return res.status(404).json({ message:"Tag not assigned" });
    res.json({ message:"Tag removed" });
  }catch(e){ next(e); }
};

export const listEstablishmentTags = async (req,res,next)=>{
  try{
    const { estId } = req.params;
    const items = await EstablishmentTag.find({ business_establishment_id: estId });
    res.json({ items });
  }catch(e){ next(e); }
};
