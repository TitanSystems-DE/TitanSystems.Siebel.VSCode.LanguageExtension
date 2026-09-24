function Service_PreInvokeMethod(MethodName: chars, Inputs: PropertySet, Outputs: PropertySet): float {
    if (MethodName != "FindAccount") return ContinueOperation;
    var bo: BusObject = TheApplication().GetBusObject("Account");
    var bc: BusComp = bo.GetBusComp("Account");
    with (bc) {
        ActivateField("Name");
        SetViewMode(AllView);
        ClearToQuery();
        SetSearchSpec("Name", Inputs.GetProperty("Name"));
        ExecuteQuery(ForwardOnly);
        if (FirstRecord()) {
            var accountName: String = GetFieldValue("Name");
            Outputs.SetProperty("Name", accountName);
        }
    }
    return CancelOperation;
}
