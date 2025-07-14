import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
export const getTemplate = async(req,res)=>{

  try{
    const response = await axios.get(
      "https://partner.gupshup.io/partner/app/e6fc2b8d-6e8d-4713-8d91-da5323e400da/templates",
      {
        headers: {
          accept: "application/json",
          Authorization: "sk_4830e6e27ce44be5af5892c5913396b8",
        },
      }
    );
    return res.status(200).json(response.data);
  }catch(error){
    return res.status(500).json({error : error.message});
  }

}