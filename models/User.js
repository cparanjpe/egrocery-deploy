const mongoose = require('mongoose');
const { isEmail } = require('validator');
const bcrypt = require('bcrypt');
const userSchema=new mongoose.Schema({
    email:{
        type:String,
        required:[true,'Please enter email'],
        unique:true,
        lowercase:true,
        validate: [isEmail,'Please enter a valid email']
    },
    password:{
        type:String,
        required:[true,'Please enter password'],
        minlength:[6,'Password must be greater than 6 characters']
    },
    wallet:{
        required:true,
        type:Number,
        default:0
    },
    purchaseValue:{
        required:true,
        type:Number,
        default:0,

    },
    stars:{
        required:true,
        type:Number,
        default:0,
    }

});
userSchema.post('save',function(doc,next){
    console.log('new user was created and saved',doc);
    next();
});
//fire a function before doc saved to MongoDB
userSchema.pre('save',async function(next){
    const salt = await bcrypt.genSalt();
    this.password = await bcrypt.hash(this.password,salt)
    next();
});
//static method to login user
userSchema.statics.login=async function(email,password){
    const user = await this.findOne({email:email});
    if(user){
        const auth = await bcrypt.compare(password,user.password);
        console.log(password);
        if(auth){
            
            //console.log(user._id);
            return user;
        }
        throw Error('incorrect password');
        //console.log(user._id);
    }
    throw Error('incorrect email');
}
const User = mongoose.model('user',userSchema);
module.exports = User;

