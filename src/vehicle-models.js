export const VEHICLE_MODELS=Object.freeze([
  {id:'8-ball',name:'8 Ball',nameVi:'8 Ball',color:'#ff3829',description:'Red roadster · glossy 8 Ball canopy',descriptionVi:'Xe đỏ · mui bóng số 8',profile:{halfWidth:.96,halfLength:1.52,bodyTop:1.75,raised:.18,low:.03,wheelRadius:.34,wheelY:.43,wheelX:.78,wheelZ:.94}},
  {id:'monster-truck',name:'Crocodile Monster Truck',nameVi:'Xe quái vật Cá Sấu',color:'#46b968',description:'Giant tires · gold suspension · crocodile body',descriptionVi:'Lốp khổng lồ · khung vàng · thân cá sấu',profile:{halfWidth:1.25,halfLength:1.65,bodyTop:2.25,raised:.5,low:.18,wheelRadius:.6,wheelY:.69,wheelX:.98,wheelZ:.94}},
  {id:'toy-story',name:'Woody Pickup',nameVi:'Xe bán tải Woody',color:'#f2c744',description:'Cowboy hat · yellow plaid · blue pickup',descriptionVi:'Mũ cao bồi · áo caro vàng · xe xanh',profile:{halfWidth:1.12,halfLength:1.48,bodyTop:2.32,raised:.25,low:.06,wheelRadius:.35,wheelY:.44,wheelX:.79,wheelZ:.92}},
  {id:'explorer',name:'Island Explorer',nameVi:'Xe khám phá đảo',color:'#fa5837',description:'Original coral SUV · exposed hydraulics',descriptionVi:'SUV san hô nguyên bản · thủy lực',profile:{halfWidth:.84,halfLength:1.33,bodyTop:2.15,raised:.42,low:.08,wheelRadius:.35,wheelY:.45,wheelX:.8,wheelZ:.8}}
]);
export const vehicleModel=id=>VEHICLE_MODELS.find(model=>model.id===id)||VEHICLE_MODELS[0];
