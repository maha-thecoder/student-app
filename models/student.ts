import mongoose,{Schema,Document,Model} from "mongoose";



export interface IStudent extends Document{
    name:string;
    rollno:string;
    password:string;
    createdAt:Date;
}


const studentschema=new Schema<IStudent>({
    name:{type:String,required:true},
    rollno:{type:String,required:true,unique:true},
    password:{type:String,required:true},
    createdAt:{type:Date,default:Date.now}
})

const Student =
  (mongoose.models.Student as Model<IStudent>) ||
  mongoose.model<IStudent>("Student", studentschema);

export default Student